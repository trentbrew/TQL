/**
 * Insights Engine Demo
 * 
 * Demonstrates the automated insights generation from multiple related datasets.
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { InsightsEngine } from '../src/analytics/insights-engine.js';
import { readFileSync } from 'fs';

async function runDemo() {
    console.log('🔍 Starting Insights Engine Demo');
    console.log('-------------------------------');

    // Load datasets
    const postsData = JSON.parse(readFileSync('./data/real-posts.json', 'utf-8'));
    const usersData = JSON.parse(readFileSync('./data/real-users.json', 'utf-8'));

    // Create EAV stores
    const postsStore = new EAVStore();
    const usersStore = new EAVStore();

    console.log('📊 Loading Posts dataset...');
    // Convert posts to EAV facts
    postsData.forEach((post: any, index: number) => {
        const postId = `post:${post.id || index}`;
        const facts = jsonEntityFacts(postId, post, 'post');
        postsStore.addFacts(facts);
    });

    console.log('👤 Loading Users dataset...');
    // Convert users to EAV facts
    usersData.forEach((user: any, index: number) => {
        const userId = `user:${user.id || index}`;
        const facts = jsonEntityFacts(userId, user, 'user');
        usersStore.addFacts(facts);
    });

    // Create insights engine
    const insightsEngine = new InsightsEngine({
        confidenceThreshold: 0.5,
        maxInsights: 10,
        verbose: true
    });

    // Register datasets
    console.log('🔄 Registering datasets with the insights engine...');
    insightsEngine.registerDataset('posts', postsStore);
    insightsEngine.registerDataset('users', usersStore);

    // Generate insights
    console.log('✨ Generating insights...');
    const insights = insightsEngine.generateInsights();

    // Display insights
    console.log(`\n📈 Generated ${insights.length} insights:\n`);

    insights.forEach((insight, index) => {
        console.log(`Insight ${index + 1}: ${insight.title}`);
        console.log(`Type: ${insight.type}`);
        console.log(`Confidence: ${(insight.confidence * 100).toFixed(1)}%`);
        console.log(`Description: ${insight.description}`);
        console.log(`Query: ${insight.query}`);
        console.log(`Datasets: ${insight.datasets.join(', ')}`);
        console.log(`Entity Types: ${insight.entityTypes.join(', ')}`);
        console.log(`Attributes: ${insight.attributes.join(', ')}`);
        console.log('-------------------------------');
    });
}

runDemo().catch(err => {
    console.error('Error in insights demo:', err);
});