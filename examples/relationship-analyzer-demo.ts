/**
 * Dataset Relationship Analyzer Demo
 * 
 * Tests the relationship detection between multiple datasets.
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { DatasetRelationshipAnalyzer } from '../src/analytics/dataset-relationship-analyzer.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

async function runDemo() {
    console.log('🔍 Starting Dataset Relationship Analyzer Demo');
    console.log('---------------------------------------------');

    // Ensure reports directory exists
    const reportsDir = './reports';
    if (!existsSync(reportsDir)) {
        mkdirSync(reportsDir);
    }

    // Output files
    const relationshipsJsonPath = path.join(reportsDir, 'relationships.json');
    const relationshipsTextPath = path.join(reportsDir, 'relationships.txt');
    const pairAnalysisPath = path.join(reportsDir, 'pair_analysis.txt');
    const mermaidDiagramPath = path.join(reportsDir, 'er_diagram.mmd');

    // Load datasets
    console.log('Loading datasets...');

    // 1. Posts and Users (clear relationship via userId)
    const postsData = JSON.parse(readFileSync('./data/real-posts.json', 'utf-8'));
    const usersData = JSON.parse(readFileSync('./data/real-users.json', 'utf-8'));

    // 2. Photos and Albums (another relationship)
    const photosData = JSON.parse(readFileSync('./data/real-photos.json', 'utf-8'));
    const albumsData = JSON.parse(readFileSync('./data/real-albums.json', 'utf-8'));

    // Create EAV stores
    const postsStore = new EAVStore();
    const usersStore = new EAVStore();
    const photosStore = new EAVStore();
    const albumsStore = new EAVStore();

    console.log('Converting to EAV facts...');

    // Convert posts to EAV facts
    postsData.forEach((post: any, index: number) => {
        const postId = `post:${post.id || index}`;
        const facts = jsonEntityFacts(postId, post, 'post');
        postsStore.addFacts(facts);
    });

    // Convert users to EAV facts
    usersData.forEach((user: any, index: number) => {
        const userId = `user:${user.id || index}`;
        const facts = jsonEntityFacts(userId, user, 'user');
        usersStore.addFacts(facts);
    });

    // Convert photos to EAV facts
    photosData.forEach((photo: any, index: number) => {
        const photoId = `photo:${photo.id || index}`;
        const facts = jsonEntityFacts(photoId, photo, 'photo');
        photosStore.addFacts(facts);
    });

    // Convert albums to EAV facts
    albumsData.forEach((album: any, index: number) => {
        const albumId = `album:${album.id || index}`;
        const facts = jsonEntityFacts(albumId, album, 'album');
        albumsStore.addFacts(facts);
    });

    // Create analyzer
    console.log('Creating relationship analyzer...');
    const analyzer = new DatasetRelationshipAnalyzer();

    // Add datasets
    analyzer.addDataset('posts', postsStore);
    analyzer.addDataset('users', usersStore);
    analyzer.addDataset('photos', photosStore);
    analyzer.addDataset('albums', albumsStore);

    // Analyze relationships
    console.log('Analyzing relationships between datasets...');
    const relationships = analyzer.analyzeRelationships({
        minConfidence: 0.4,
        maxRelationships: 10,
        ignoredAttributes: ['type', 'id']
    });

    // Display results
    console.log(`\n🔗 Found ${relationships.length} potential relationships:\n`);

    // Generate the text report
    let textReport = `DATASET RELATIONSHIP ANALYSIS REPORT\n`;
    textReport += `Generated: ${new Date().toISOString()}\n`;
    textReport += `=======================================\n\n`;
    textReport += `Found ${relationships.length} potential relationships:\n\n`;

    relationships.forEach((rel, index) => {
        console.log(`Relationship ${index + 1}:`);
        console.log(`  Source: ${rel.sourceDataset}.${rel.sourceType}.${rel.sourceAttribute}`);
        console.log(`  Target: ${rel.targetDataset}.${rel.targetType}.${rel.targetAttribute}`);
        console.log(`  Type: ${rel.relationship.type}`);
        console.log(`  Confidence: ${(rel.relationship.confidence * 100).toFixed(1)}%`);
        console.log(`  Description: ${rel.relationship.description}`);

        // Add to text report
        textReport += `Relationship ${index + 1}:\n`;
        textReport += `  Source: ${rel.sourceDataset}.${rel.sourceType}.${rel.sourceAttribute}\n`;
        textReport += `  Target: ${rel.targetDataset}.${rel.targetType}.${rel.targetAttribute}\n`;
        textReport += `  Type: ${rel.relationship.type}\n`;
        textReport += `  Confidence: ${(rel.relationship.confidence * 100).toFixed(1)}%\n`;
        textReport += `  Description: ${rel.relationship.description}\n`;

        // Display a few examples
        if (rel.examples.length > 0) {
            console.log('  Examples:');
            textReport += '  Examples:\n';
            const exampleCount = Math.min(3, rel.examples.length);
            for (let i = 0; i < exampleCount; i++) {
                const example = rel.examples[i];
                if (example) {
                    const sourceStr = typeof example.source === 'object' ? JSON.stringify(example.source) : example.source;
                    const targetStr = typeof example.target === 'object' ? JSON.stringify(example.target) : example.target;
                    console.log(`    - Source: ${sourceStr} → Target: ${targetStr}`);
                    textReport += `    - Source: ${sourceStr} → Target: ${targetStr}\n`;
                }
            }
        }

        console.log('');
        textReport += '\n';
    });

    // Save to files
    writeFileSync(relationshipsJsonPath, JSON.stringify(relationships, null, 2));
    writeFileSync(relationshipsTextPath, textReport);
    console.log(`✅ Relationships saved to:\n  - ${relationshipsJsonPath}\n  - ${relationshipsTextPath}`);

    // Test specific dataset relationships
    console.log('\n🧪 Testing specific dataset pairs:');

    // Create pair analysis report
    let pairAnalysisReport = `DATASET PAIR ANALYSIS REPORT\n`;
    pairAnalysisReport += `Generated: ${new Date().toISOString()}\n`;
    pairAnalysisReport += `=======================================\n\n`;

    const testPairs = [
        { source: 'posts', target: 'users' },
        { source: 'photos', target: 'albums' },
        { source: 'posts', target: 'photos' }
    ];

    for (const { source, target } of testPairs) {
        console.log(`\n📊 Analyzing ${source} ↔ ${target}:`);
        pairAnalysisReport += `\n📊 Analyzing ${source} ↔ ${target}:\n`;

        const sourceStore = source === 'posts' ? postsStore :
            source === 'users' ? usersStore :
                source === 'photos' ? photosStore : albumsStore;

        const targetStore = target === 'posts' ? postsStore :
            target === 'users' ? usersStore :
                target === 'photos' ? photosStore : albumsStore;

        const pairAnalyzer = new DatasetRelationshipAnalyzer();
        pairAnalyzer.addDataset(source, sourceStore);
        pairAnalyzer.addDataset(target, targetStore);

        const pairRelationships = pairAnalyzer.analyzeRelationships({
            minConfidence: 0.3  // Lower threshold to see more potential relationships
        });

        if (pairRelationships.length === 0) {
            console.log(`  No relationships found between ${source} and ${target}`);
            pairAnalysisReport += `  No relationships found between ${source} and ${target}\n`;
            continue;
        }

        pairRelationships.forEach((rel, index) => {
            const relationshipLine = `  ${index + 1}. ${rel.sourceAttribute} → ${rel.targetAttribute} (${rel.relationship.type}, ${(rel.relationship.confidence * 100).toFixed(1)}%)`;
            console.log(relationshipLine);
            pairAnalysisReport += relationshipLine + '\n';
        });
    }

    // Save pair analysis to file
    writeFileSync(pairAnalysisPath, pairAnalysisReport);
    console.log(`\n✅ Pair analysis saved to:\n  - ${pairAnalysisPath}`);

    // Generate Mermaid ER Diagram
    console.log('\n📊 Generating ER Diagram...');

    // Create maps to track entities and relationships
    const entities = new Map<string, {
        name: string,
        dataset: string,
        attributes: Set<string>,
        attributeTypes: Map<string, string>
    }>();
    const relationshipMap = new Map<string, {
        source: string,
        sourceAttr: string,
        target: string,
        targetAttr: string,
        relationship: string,
        description: string
    }>();

    // Helper to ensure entity is in the map
    const ensureEntity = (dataset: string, type: string): string => {
        const entityKey = `${dataset}.${type}`;
        if (!entities.has(entityKey)) {
            entities.set(entityKey, {
                name: type,
                dataset: dataset,
                attributes: new Set<string>(),
                attributeTypes: new Map<string, string>()
            });
        }
        return entityKey;
    };

    // Helper to determine attribute type
    const determineAttributeType = (attrName: string): string => {
        let attrType = 'string';
        if (attrName.toLowerCase().includes('id')) attrType = 'number';
        else if (attrName.toLowerCase().includes('date')) attrType = 'date';
        else if (attrName.toLowerCase().includes('count') ||
            attrName.toLowerCase().includes('amount') ||
            attrName.toLowerCase().includes('total') ||
            attrName.toLowerCase().includes('number')) attrType = 'number';
        return attrType;
    };

    // Process all relationships
    console.log(`Processing ${relationships.length} relationships for diagram...`);

    // Add additional common attributes to entities for a more complete diagram
    const addCommonAttributes = () => {
        // Posts usually have these attributes
        const postEntity = entities.get('posts.post');
        if (postEntity) {
            ['title', 'body', 'date', 'views'].forEach(attr => {
                if (!postEntity.attributes.has(attr)) {
                    postEntity.attributes.add(attr);
                    postEntity.attributeTypes.set(attr, determineAttributeType(attr));
                }
            });
        }

        // Users usually have these attributes
        const userEntity = entities.get('users.user');
        if (userEntity) {
            ['name', 'email', 'username', 'phone', 'website'].forEach(attr => {
                if (!userEntity.attributes.has(attr)) {
                    userEntity.attributes.add(attr);
                    userEntity.attributeTypes.set(attr, determineAttributeType(attr));
                }
            });
        }

        // Photos usually have these attributes
        const photoEntity = entities.get('photos.photo');
        if (photoEntity) {
            ['title', 'url', 'thumbnailUrl'].forEach(attr => {
                if (!photoEntity.attributes.has(attr)) {
                    photoEntity.attributes.add(attr);
                    photoEntity.attributeTypes.set(attr, determineAttributeType(attr));
                }
            });
        }

        // Albums usually have these attributes
        const albumEntity = entities.get('albums.album');
        if (albumEntity) {
            ['title'].forEach(attr => {
                if (!albumEntity.attributes.has(attr)) {
                    albumEntity.attributes.add(attr);
                    albumEntity.attributeTypes.set(attr, determineAttributeType(attr));
                }
            });
        }
    };

    // Now process relationships to build connections
    relationships.forEach(rel => {
        // Only process relationships with confidence above 60% to include more in diagram
        if (rel.relationship.confidence < 0.6) {
            console.log(`Skipping low confidence relationship: ${rel.sourceAttribute} -> ${rel.targetAttribute} (${rel.relationship.confidence})`);
            return;
        }

        const sourceKey = ensureEntity(rel.sourceDataset, rel.sourceType);
        const targetKey = ensureEntity(rel.targetDataset, rel.targetType);

        // Add attributes to entities
        const sourceEntity = entities.get(sourceKey);
        const targetEntity = entities.get(targetKey);

        if (sourceEntity && targetEntity) {
            // Add attributes and their types
            sourceEntity.attributes.add(rel.sourceAttribute);
            sourceEntity.attributeTypes.set(rel.sourceAttribute, determineAttributeType(rel.sourceAttribute));

            targetEntity.attributes.add(rel.targetAttribute);
            targetEntity.attributeTypes.set(rel.targetAttribute, determineAttributeType(rel.targetAttribute));

            // Track relationship for diagram
            if (rel.relationship.type === 'foreignKey') {
                const relationshipKey = `${sourceKey}:${rel.sourceAttribute}|${targetKey}:${rel.targetAttribute}`;

                // Determine cardinality based on the data
                // For foreign keys, typically it's one-to-many relationship (||--o{)
                const relationshipType = "||--o{";

                // Create a shorter, more readable description
                let description = "";
                if (rel.sourceAttribute === "userId" && rel.targetAttribute === "id") {
                    description = "created by";
                } else if (rel.sourceAttribute === "albumId" && rel.targetAttribute === "id") {
                    description = "belongs to";
                } else {
                    description = `references via ${rel.sourceAttribute}`;
                }

                relationshipMap.set(relationshipKey, {
                    source: rel.sourceType,
                    sourceAttr: rel.sourceAttribute,
                    target: rel.targetType,
                    targetAttr: rel.targetAttribute,
                    relationship: relationshipType,
                    description: description
                });
                console.log(`Adding relationship: ${relationshipKey} (${relationshipType})`);
            } else if (rel.relationship.type === 'sameAttribute' && rel.relationship.confidence >= 0.8) {
                // For same attributes with high confidence, add a relationship too
                const relationshipKey = `${sourceKey}:${rel.sourceAttribute}|${targetKey}:${rel.targetAttribute}`;

                // For same attributes, it's often a reference relationship (||--|{)
                const relationshipType = "||--|{";

                // Create a more meaningful description for same attributes
                let description = "";
                if (rel.sourceAttribute === "userId" && rel.targetAttribute === "userId") {
                    description = "shares user with";
                } else {
                    description = `shares ${rel.sourceAttribute} with`;
                }

                relationshipMap.set(relationshipKey, {
                    source: rel.sourceType,
                    sourceAttr: rel.sourceAttribute,
                    target: rel.targetType,
                    targetAttr: rel.targetAttribute,
                    relationship: relationshipType,
                    description: description
                });
                console.log(`Adding same attribute relationship: ${relationshipKey} (${relationshipType})`);
            }
        }
    });

    // Add common attributes for a more complete diagram
    addCommonAttributes();

    // Generate Mermaid ER diagram content
    let mermaidContent = 'erDiagram\n';

    // Add relationships first (to match the example format)
    console.log(`Found ${relationshipMap.size} relationships for diagram`);
    relationshipMap.forEach(rel => {
        mermaidContent += `    ${rel.source.toUpperCase()} ${rel.relationship} ${rel.target.toUpperCase()} : "${rel.description}"\n`;
    });

    // Add entities with attributes
    entities.forEach(entity => {
        mermaidContent += `    ${entity.name.toUpperCase()} {\n`;

        // Sort attributes to show IDs first
        const sortedAttributes = Array.from(entity.attributes).sort((a, b) => {
            // ID fields come first
            if (a.toLowerCase().includes('id') && !b.toLowerCase().includes('id')) return -1;
            if (!a.toLowerCase().includes('id') && b.toLowerCase().includes('id')) return 1;
            return a.localeCompare(b);
        });

        // Add each attribute with its type
        sortedAttributes.forEach(attr => {
            const attrType = entity.attributeTypes.get(attr) || 'string';
            mermaidContent += `        ${attrType} ${attr}\n`;
        });

        mermaidContent += '    }\n';
    });

    // Save the Mermaid diagram
    writeFileSync(mermaidDiagramPath, mermaidContent);
    console.log(`✅ ER Diagram saved to:\n  - ${mermaidDiagramPath}`);
}

runDemo().catch(err => {
    console.error('Error in relationship analyzer demo:', err);
});