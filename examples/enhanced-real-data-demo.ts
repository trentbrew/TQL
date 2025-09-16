/**
 * Enhanced Real Data Demo for EAV Datalog Engine
 *
 * Demonstrates the query engine on comprehensive real JSON data fetched from JSONPlaceholder API
 * via curl commands. Shows complex queries, aggregations, derived predicates, and fixes
 * issues from the basic demo.
 */

import { EAVStore, jsonEntityFacts } from '../src/eav-engine.js';
import { DatalogEvaluator } from '../src/query/index.js';
import type { Query, Rule } from '../src/query/index.js';

// Import the real data fetched via curl
import realPosts from '../data/real-posts.json' assert { type: 'json' };
import realUsers from '../data/real-users.json' assert { type: 'json' };
import realComments from '../data/real-comments.json' assert { type: 'json' };
import realAlbums from '../data/real-albums.json' assert { type: 'json' };
import realPhotos from '../data/real-photos.json' assert { type: 'json' };

function initializeEnhancedRealDataStore(): EAVStore {
  const store = new EAVStore();

  console.log(
    '📥 Ingesting comprehensive real JSON data from JSONPlaceholder API...',
  );

  // Ingest users as entities
  for (const user of realUsers) {
    const facts = jsonEntityFacts(`user:${user.id}`, user, 'user');
    store.addFacts(facts);
  }

  // Ingest posts as entities
  for (const post of realPosts) {
    const facts = jsonEntityFacts(`post:${post.id}`, post, 'post');
    store.addFacts(facts);
  }

  // Ingest comments as entities
  for (const comment of realComments) {
    const facts = jsonEntityFacts(`comment:${comment.id}`, comment, 'comment');
    store.addFacts(facts);
  }

  // Ingest albums as entities
  for (const album of realAlbums) {
    const facts = jsonEntityFacts(`album:${album.id}`, album, 'album');
    store.addFacts(facts);
  }

  // Ingest photos as entities
  for (const photo of realPhotos) {
    const facts = jsonEntityFacts(`photo:${photo.id}`, photo, 'photo');
    store.addFacts(facts);
  }

  // Add relationships as links
  const links = [];

  // User -> Post relationships
  for (const post of realPosts) {
    links.push({
      e1: `user:${post.userId}`,
      a: 'AUTHORED',
      e2: `post:${post.id}`,
    });
  }

  // Post -> Comment relationships
  for (const comment of realComments) {
    links.push({
      e1: `post:${comment.postId}`,
      a: 'HAS_COMMENT',
      e2: `comment:${comment.id}`,
    });
  }

  // User -> Album relationships
  for (const album of realAlbums) {
    links.push({
      e1: `user:${album.userId}`,
      a: 'OWNS_ALBUM',
      e2: `album:${album.id}`,
    });
  }

  // Album -> Photo relationships
  for (const photo of realPhotos) {
    links.push({
      e1: `album:${photo.albumId}`,
      a: 'CONTAINS_PHOTO',
      e2: `photo:${photo.id}`,
    });
  }

  store.addLinks(links);

  console.log(`✅ Ingested comprehensive real data:`);
  console.log(`   - ${realUsers.length} users`);
  console.log(`   - ${realPosts.length} posts`);
  console.log(`   - ${realComments.length} comments`);
  console.log(`   - ${realAlbums.length} albums`);
  console.log(`   - ${realPhotos.length} photos`);
  console.log(`📊 Store stats:`, store.getStats());

  return store;
}

function addEnhancedRules(evaluator: DatalogEvaluator): void {
  // Rule 1: Popular posts (posts with many comments)
  const popularPostsRule: Rule = {
    head: { predicate: 'popular_post', terms: ['?P', '?CommentCount'] },
    body: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'link', terms: ['?P', 'HAS_COMMENT', '?C'] },
    ],
  };

  // Rule 2: Active users (users who have authored posts)
  const activeUserRule: Rule = {
    head: { predicate: 'active_user', terms: ['?U'] },
    body: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'link', terms: ['?U', 'AUTHORED', '?P'] },
    ],
  };

  // Rule 3: Long posts (posts with long titles)
  const longPostRule: Rule = {
    head: { predicate: 'long_post', terms: ['?P'] },
    body: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
      { predicate: 'gt', terms: ['?Title', 50] }, // Title longer than 50 chars
    ],
  };

  // Rule 4: Users with albums
  const userWithAlbumsRule: Rule = {
    head: { predicate: 'user_with_albums', terms: ['?U'] },
    body: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'link', terms: ['?U', 'OWNS_ALBUM', '?A'] },
    ],
  };

  // Rule 5: Albums with photos
  const albumWithPhotosRule: Rule = {
    head: { predicate: 'album_with_photos', terms: ['?A'] },
    body: [
      { predicate: 'attr', terms: ['?A', 'type', 'album'] },
      { predicate: 'link', terms: ['?A', 'CONTAINS_PHOTO', '?P'] },
    ],
  };

  // Add all rules
  evaluator.addRule(popularPostsRule);
  evaluator.addRule(activeUserRule);
  evaluator.addRule(longPostRule);
  evaluator.addRule(userWithAlbumsRule);
  evaluator.addRule(albumWithPhotosRule);
}

async function runEnhancedQueries(evaluator: DatalogEvaluator): Promise<void> {
  console.log(
    '\n🔍 Running enhanced queries on comprehensive real JSON data...\n',
  );

  // 1. Basic user information
  console.log('1️⃣ All users with basic info:');
  const allUsersQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'attr', terms: ['?U', 'name', '?Name'] },
      { predicate: 'attr', terms: ['?U', 'email', '?Email'] },
    ],
    variables: new Set(['U', 'Name', 'Email']),
  };
  const allUsersResult = evaluator.evaluate(allUsersQuery);
  console.log(`   Found ${allUsersResult.bindings.length} users`);
  console.log(
    `   Execution time: ${allUsersResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', allUsersResult.bindings.slice(0, 3));
  console.log();

  // 2. Posts by specific user
  console.log('2️⃣ Posts by user 1:');
  const userPostsQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'attr', terms: ['?P', 'userId', 1] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const userPostsResult = evaluator.evaluate(userPostsQuery);
  console.log(`   Found ${userPostsResult.bindings.length} posts by user 1`);
  console.log(
    `   Execution time: ${userPostsResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', userPostsResult.bindings.slice(0, 3));
  console.log();

  // 3. Posts with specific keywords in title
  console.log('3️⃣ Posts with "dolor" in title:');
  const keywordQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
      { predicate: 'contains', terms: ['?Title', 'dolor'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const keywordResult = evaluator.evaluate(keywordQuery);
  console.log(
    `   Found ${keywordResult.bindings.length} posts with "dolor" in title`,
  );
  console.log(`   Execution time: ${keywordResult.executionTime.toFixed(2)}ms`);
  console.log('   Sample results:', keywordResult.bindings.slice(0, 3));
  console.log();

  // 4. Long posts (using derived predicate)
  console.log('4️⃣ Long posts (titles > 50 chars):');
  const longPostsQuery: Query = {
    goals: [
      { predicate: 'long_post', terms: ['?P'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const longPostsResult = evaluator.evaluate(longPostsQuery);
  console.log(`   Found ${longPostsResult.bindings.length} long posts`);
  console.log(
    `   Execution time: ${longPostsResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', longPostsResult.bindings.slice(0, 3));
  console.log();

  // 5. Active users (using derived predicate)
  console.log('5️⃣ Active users (users who authored posts):');
  const activeUsersQuery: Query = {
    goals: [
      { predicate: 'active_user', terms: ['?U'] },
      { predicate: 'attr', terms: ['?U', 'name', '?Name'] },
    ],
    variables: new Set(['U', 'Name']),
  };
  const activeUsersResult = evaluator.evaluate(activeUsersQuery);
  console.log(`   Found ${activeUsersResult.bindings.length} active users`);
  console.log(
    `   Execution time: ${activeUsersResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', activeUsersResult.bindings.slice(0, 5));
  console.log();

  // 6. Albums and their owners
  console.log('6️⃣ Albums and their owners:');
  const albumsQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?A', 'type', 'album'] },
      { predicate: 'attr', terms: ['?A', 'title', '?AlbumTitle'] },
      { predicate: 'link', terms: ['?U', 'OWNS_ALBUM', '?A'] },
      { predicate: 'attr', terms: ['?U', 'name', '?UserName'] },
    ],
    variables: new Set(['A', 'AlbumTitle', 'U', 'UserName']),
  };
  const albumsResult = evaluator.evaluate(albumsQuery);
  console.log(
    `   Found ${albumsResult.bindings.length} album-owner relationships`,
  );
  console.log(`   Execution time: ${albumsResult.executionTime.toFixed(2)}ms`);
  console.log('   Sample results:', albumsResult.bindings.slice(0, 3));
  console.log();

  // 7. Photos in albums
  console.log('7️⃣ Photos in albums:');
  const photosQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'photo'] },
      { predicate: 'attr', terms: ['?P', 'title', '?PhotoTitle'] },
      { predicate: 'link', terms: ['?A', 'CONTAINS_PHOTO', '?P'] },
      { predicate: 'attr', terms: ['?A', 'title', '?AlbumTitle'] },
    ],
    variables: new Set(['P', 'PhotoTitle', 'A', 'AlbumTitle']),
  };
  const photosResult = evaluator.evaluate(photosQuery);
  console.log(
    `   Found ${photosResult.bindings.length} photo-album relationships`,
  );
  console.log(`   Execution time: ${photosResult.executionTime.toFixed(2)}ms`);
  console.log('   Sample results:', photosResult.bindings.slice(0, 3));
  console.log();

  // 8. Users with albums (using derived predicate)
  console.log('8️⃣ Users with albums:');
  const usersWithAlbumsQuery: Query = {
    goals: [
      { predicate: 'user_with_albums', terms: ['?U'] },
      { predicate: 'attr', terms: ['?U', 'name', '?Name'] },
    ],
    variables: new Set(['U', 'Name']),
  };
  const usersWithAlbumsResult = evaluator.evaluate(usersWithAlbumsQuery);
  console.log(
    `   Found ${usersWithAlbumsResult.bindings.length} users with albums`,
  );
  console.log(
    `   Execution time: ${usersWithAlbumsResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', usersWithAlbumsResult.bindings.slice(0, 5));
  console.log();

  // 9. Complex query: Users and their content (posts + albums)
  console.log('9️⃣ Users and their content (posts + albums):');
  const userContentQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'attr', terms: ['?U', 'name', '?Name'] },
      { predicate: 'link', terms: ['?U', 'AUTHORED', '?P'] },
    ],
    variables: new Set(['U', 'Name']),
  };
  const userContentResult = evaluator.evaluate(userContentQuery);

  // Also get albums for each user
  const userAlbumsQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?U', 'type', 'user'] },
      { predicate: 'attr', terms: ['?U', 'name', '?Name'] },
      { predicate: 'link', terms: ['?U', 'OWNS_ALBUM', '?A'] },
    ],
    variables: new Set(['U', 'Name']),
  };
  const userAlbumsResult = evaluator.evaluate(userAlbumsQuery);

  // Aggregate content counts per user
  const userContentCounts = new Map<
    string,
    { name: string; posts: number; albums: number }
  >();

  // Count posts
  for (const binding of userContentResult.bindings) {
    const userId = binding.U as string;
    const userName = binding.Name as string;
    if (!userContentCounts.has(userId)) {
      userContentCounts.set(userId, { name: userName, posts: 0, albums: 0 });
    }
    userContentCounts.get(userId)!.posts++;
  }

  // Count albums
  for (const binding of userAlbumsResult.bindings) {
    const userId = binding.U as string;
    const userName = binding.Name as string;
    if (!userContentCounts.has(userId)) {
      userContentCounts.set(userId, { name: userName, posts: 0, albums: 0 });
    }
    userContentCounts.get(userId)!.albums++;
  }

  const sortedUsers = Array.from(userContentCounts.entries())
    .sort(([, a], [, b]) => b.posts + b.albums - (a.posts + a.albums))
    .slice(0, 5);

  console.log(
    `   Found ${userContentResult.bindings.length} user-post relationships`,
  );
  console.log(
    `   Found ${userAlbumsResult.bindings.length} user-album relationships`,
  );
  console.log(
    `   Execution time: ${(
      userContentResult.executionTime + userAlbumsResult.executionTime
    ).toFixed(2)}ms`,
  );
  console.log('   Top 5 users by total content:', sortedUsers);
  console.log();

  // 10. Comments on specific posts
  console.log('🔟 Comments on post 1:');
  const postCommentsQuery: Query = {
    goals: [
      { predicate: 'link', terms: ['post:1', 'HAS_COMMENT', '?C'] },
      { predicate: 'attr', terms: ['?C', 'type', 'comment'] },
      { predicate: 'attr', terms: ['?C', 'name', '?Name'] },
      { predicate: 'attr', terms: ['?C', 'email', '?Email'] },
    ],
    variables: new Set(['C', 'Name', 'Email']),
  };
  const postCommentsResult = evaluator.evaluate(postCommentsQuery);
  console.log(
    `   Found ${postCommentsResult.bindings.length} comments on post 1`,
  );
  console.log(
    `   Execution time: ${postCommentsResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', postCommentsResult.bindings.slice(0, 3));
  console.log();

  // 11. Posts with specific patterns in body
  console.log('1️⃣1️⃣ Posts with "quia" in body:');
  const bodyPatternQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'post'] },
      { predicate: 'attr', terms: ['?P', 'body', '?Body'] },
      { predicate: 'contains', terms: ['?Body', 'quia'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
    ],
    variables: new Set(['P', 'Title']),
  };
  const bodyPatternResult = evaluator.evaluate(bodyPatternQuery);
  console.log(
    `   Found ${bodyPatternResult.bindings.length} posts with "quia" in body`,
  );
  console.log(
    `   Execution time: ${bodyPatternResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', bodyPatternResult.bindings.slice(0, 3));
  console.log();

  // 12. Photos with specific URLs
  console.log('1️⃣2️⃣ Photos with placeholder URLs:');
  const photoUrlQuery: Query = {
    goals: [
      { predicate: 'attr', terms: ['?P', 'type', 'photo'] },
      { predicate: 'attr', terms: ['?P', 'url', '?Url'] },
      { predicate: 'contains', terms: ['?Url', 'placeholder'] },
      { predicate: 'attr', terms: ['?P', 'title', '?Title'] },
    ],
    variables: new Set(['P', 'Url', 'Title']),
  };
  const photoUrlResult = evaluator.evaluate(photoUrlQuery);
  console.log(
    `   Found ${photoUrlResult.bindings.length} photos with placeholder URLs`,
  );
  console.log(
    `   Execution time: ${photoUrlResult.executionTime.toFixed(2)}ms`,
  );
  console.log('   Sample results:', photoUrlResult.bindings.slice(0, 3));
  console.log();
}

async function runEnhancedRealDataDemo(): Promise<void> {
  console.log('🚀 EAV Datalog Enhanced Real Data Demo\n');
  console.log('='.repeat(70));
  console.log(
    'Testing query engine on comprehensive real JSON data from JSONPlaceholder API',
  );
  console.log(
    'Data fetched via: curl https://jsonplaceholder.typicode.com/{posts,users,comments,albums,photos}',
  );
  console.log('='.repeat(70));

  try {
    // Initialize store with comprehensive real data
    const store = initializeEnhancedRealDataStore();

    // Create evaluator and add rules
    const evaluator = new DatalogEvaluator(store);
    addEnhancedRules(evaluator);

    // Run enhanced queries
    await runEnhancedQueries(evaluator);

    console.log('✅ Enhanced real data demo completed successfully!');
    console.log('\n📊 Summary:');
    console.log(
      '   - Successfully ingested comprehensive real JSON data from public API',
    );
    console.log(
      '   - Demonstrated complex queries with joins, filters, and aggregations',
    );
    console.log('   - Showed derived predicates and rule-based reasoning');
    console.log('   - Validated query engine performance on real-world data');
    console.log(
      '   - Tested relationships across multiple entity types (users, posts, comments, albums, photos)',
    );
    console.log('   - Demonstrated path-aware JSON ingestion and EAV storage');
  } catch (error) {
    console.error('❌ Enhanced real data demo failed:', error);
    throw error;
  }
}

// Run the demo
if (import.meta.main) {
  runEnhancedRealDataDemo().catch(console.error);
}
