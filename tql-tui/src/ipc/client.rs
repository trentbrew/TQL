use color_eyre::Result;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};

use super::protocol::{Request, Response};

pub struct IPCClient {
    process: Option<Child>,
    stdin: Option<ChildStdin>,
    stdout: Option<BufReader<ChildStdout>>,
    request_id: AtomicU64,
}

impl IPCClient {
    pub fn new() -> Self {
        IPCClient {
            process: None,
            stdin: None,
            stdout: None,
            request_id: AtomicU64::new(1),
        }
    }

    pub fn connect(&mut self, command: &str, args: &[&str]) -> Result<()> {
        let mut child = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()?;

        self.stdin = child.stdin.take();
        self.stdout = child.stdout.take().map(BufReader::new);
        self.process = Some(child);

        Ok(())
    }

    pub fn send(&mut self, request: Request) -> Result<()> {
        if let Some(stdin) = &mut self.stdin {
            let json = serde_json::to_string(&request)?;
            writeln!(stdin, "{}", json)?;
            stdin.flush()?;
        }
        Ok(())
    }

    pub fn receive(&mut self) -> Result<Option<Response>> {
        if let Some(stdout) = &mut self.stdout {
            let mut line = String::new();
            let bytes_read = stdout.read_line(&mut line)?;
            
            if bytes_read == 0 {
                return Ok(None);
            }

            let response: Response = serde_json::from_str(&line)?;
            Ok(Some(response))
        } else {
            Ok(None)
        }
    }

    pub fn next_id(&self) -> u64 {
        self.request_id.fetch_add(1, Ordering::SeqCst)
    }
}

impl Default for IPCClient {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for IPCClient {
    fn drop(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
        }
    }
}
