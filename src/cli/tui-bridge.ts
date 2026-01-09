import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Graph } from '../graph/graph.js';

interface IPCMessage {
  jsonrpc: '2.0';
  method?: string;
  params?: any;
  result?: any;
  error?: string;
  id: number;
}

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    state: 'pending' | 'running' | 'success' | 'error';
    position?: [number, number];
  }>;
  edges: Array<{
    from: string;
    to: string;
    label: string;
  }>;
}

export class TQLTUIBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 1;
  private pendingRequests = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();

  async launchGraphViewer(graph?: Graph, watch = false): Promise<void> {
    const args = ['graph', '--ipc'];
    if (watch) args.push('--watch');

    await this.spawn('tql-tui', args);

    if (graph) {
      await this.loadGraph(graph);
    }
  }

  async launchQueryBuilder(dataFile?: string): Promise<void> {
    const args = ['query', '--ipc'];
    if (dataFile) {
      args.push('--data', dataFile);
    }

    await this.spawn('tql-tui', args);
  }

  async launchWorkflowMonitor(workflowFile: string): Promise<void> {
    await this.spawn('tql-tui', ['workflow', '--ipc', '--file', workflowFile]);
  }

  async launchDataExplorer(dataFile: string): Promise<void> {
    await this.spawn('tql-tui', ['explore', '--ipc', dataFile]);
  }

  async launchDashboard(workspace?: string): Promise<void> {
    const args = ['dashboard', '--ipc'];
    if (workspace) {
      args.push('--workspace', workspace);
    }

    await this.spawn('tql-tui', args);
  }

  private async spawn(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get the project root directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const projectRoot = join(__dirname, '..', '..');
      
      // Try to use the built binary from target/debug or target/release
      const debugBinary = join(projectRoot, 'tql-tui', 'target', 'debug', command);
      const releaseBinary = join(projectRoot, 'tql-tui', 'target', 'release', command);
      
      // Try release first, then debug, then system PATH
      let binaryPath = command;
      try {
        const fs = require('fs');
        if (fs.existsSync(releaseBinary)) {
          binaryPath = releaseBinary;
        } else if (fs.existsSync(debugBinary)) {
          binaryPath = debugBinary;
        }
      } catch (e) {
        // Fall back to PATH
      }
      
      this.process = spawn(binaryPath, args, {
        stdio: ['pipe', 'pipe', 'inherit'],
      });

      if (!this.process.stdin || !this.process.stdout) {
        reject(new Error('Failed to create stdio streams'));
        return;
      }

      this.process.stdout.on('data', (data) => {
        this.handleMessage(data.toString());
      });

      this.process.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.process.on('exit', (code) => {
        this.emit('exit', code);
        this.cleanup();
      });

      // Give the process a moment to start
      setTimeout(() => resolve(), 100);
    });
  }

  private handleMessage(data: string): void {
    const lines = data.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      try {
        const message: IPCMessage = JSON.parse(line);

        // Handle response
        if ('result' in message || 'error' in message) {
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            if (message.error) {
              pending.reject(new Error(message.error));
            } else {
              pending.resolve(message.result);
            }
            this.pendingRequests.delete(message.id);
          }
        }

        // Handle request from Rust
        if (message.method) {
          this.handleRequest(message);
        }
      } catch (error) {
        console.error('Failed to parse IPC message:', error);
      }
    }
  }

  private async handleRequest(message: IPCMessage): Promise<void> {
    try {
      let result: any;

      switch (message.method) {
        case 'executeQuery':
          result = await this.handleExecuteQuery(message.params);
          break;
        case 'getEntity':
          result = await this.handleGetEntity(message.params);
          break;
        default:
          throw new Error(`Unknown method: ${message.method}`);
      }

      this.send({
        jsonrpc: '2.0',
        result,
        id: message.id,
      });
    } catch (error) {
      this.send({
        jsonrpc: '2.0',
        error: error instanceof Error ? error.message : 'Unknown error',
        id: message.id,
      });
    }
  }

  private async handleExecuteQuery(params: any): Promise<any> {
    // Emit event for the host application to handle
    return new Promise((resolve, reject) => {
      this.emit('executeQuery', params.query, (error: Error | null, result: any) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  private async handleGetEntity(params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.emit('getEntity', params.entityId, (error: Error | null, result: any) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  async loadGraph(graph: Graph): Promise<void> {
    const graphData: GraphData = {
      nodes: Array.from(graph.allNodes()).map((node) => ({
        id: node.id,
        label: node.label || node.id,
        type: node.executor || 'unknown',
        state: 'pending',
        position: undefined, // Could be computed with layout algorithm
      })),
      edges: Array.from(graph.allEdges()).map((edge) => ({
        from: edge.from,
        to: edge.to,
        label: edge.label || '',
      })),
    };

    await this.sendRequest('loadGraph', { graph: graphData });
  }

  async updateNodeState(
    nodeId: string,
    state: 'pending' | 'running' | 'success' | 'error',
    output?: any,
  ): Promise<void> {
    await this.sendRequest('updateNode', { nodeId, state, output });
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    const id = this.requestId++;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.send({
        jsonrpc: '2.0',
        method,
        params,
        id,
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          pending.reject(new Error('Request timeout'));
          this.pendingRequests.delete(id);
        }
      }, 30000);
    });
  }

  private send(message: IPCMessage): void {
    if (this.process?.stdin) {
      this.process.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  cleanup(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.pendingRequests.clear();
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}
