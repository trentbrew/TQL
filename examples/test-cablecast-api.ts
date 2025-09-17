#!/usr/bin/env bun

import { EAVStore, jsonEntityFacts, flatten } from '../src/eav-engine.js';
import fs from 'fs';

console.log('🔍 Testing Cablecast API Data Processing\n');

// Load the data from temp/channels.json
const channelsData = JSON.parse(fs.readFileSync('./temp/channels.json', 'utf-8'));

console.log('📊 Data structure from API:');
console.log(`  Top level keys: ${Object.keys(channelsData).join(', ')}`);
console.log(`  Number of channels: ${channelsData.channels.length}`);
console.log(`  Sample channel: ${JSON.stringify(channelsData.channels[0].name)}`);

// Test the flattening function directly
console.log('\n📊 Flattening results:');
const flattened = Array.from(flatten(channelsData));
console.log(`  Total flattened key-value pairs: ${flattened.length}`);
console.log('  Sample flattened paths:');
flattened.slice(0, 5).forEach(([path, value]) => {
    console.log(`  - ${path} = ${value}`);
});

// Test EAV store ingestion
console.log('\n📊 EAV store test:');
const store = new EAVStore();

// Create entity from API data
const facts = jsonEntityFacts('api:channels', channelsData, 'api');
store.addFacts(facts);

console.log(`  Added ${facts.length} facts`);
console.log('  Fact categories:');
const factTypes = new Map();
store.getAllFacts().forEach(fact => {
    const category = fact.a.split('.')[0];
    factTypes.set(category, (factTypes.get(category) || 0) + 1);
});
console.log('  Fact categories distribution:');
factTypes.forEach((count, category) => {
    console.log(`  - ${category}: ${count} facts`);
});

// Show channel names and IDs specifically
console.log('\n📊 Channel Information:');
const channelNames = store.getFactsByAttribute('channels.name');
const channelIds = store.getFactsByAttribute('channels.id');

console.log('  Channel Names and IDs:');
for (let i = 0; i < channelNames.length; i++) {
    const nameVal = channelNames[i].v;
    const idVal = channelIds[i].v;
    console.log(`  - Channel ${idVal}: ${nameVal}`);
}

console.log('\n✅ Test completed');