import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import CategoryTag from '../models/CategoryTag.js';
import Tag from '../models/Tag.js';

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const findTargetUser = async () => {
  const targetUsers = await User.find({
    $or: [
      { username: /^wray$/i },
      { nickname: /^wray$/i },
    ],
  }).select('_id username nickname role');

  if (targetUsers.length !== 1) {
    throw new Error(
      `Expected exactly one Wray user, found ${targetUsers.length}. Create or consolidate the target user first.`
    );
  }

  return targetUsers[0];
};

const getMigrationPlan = async (Model, label, targetUserId) => {
  const sourceDocuments = await Model.find({
    author: { $ne: targetUserId },
  }).select('_id name').lean();
  const targetDocuments = await Model.find({
    author: targetUserId,
  }).select('name').lean();

  const sourceNames = sourceDocuments.map((document) => document.name);
  const targetNames = new Set(targetDocuments.map((document) => document.name));
  const duplicateSourceNames = sourceNames.filter(
    (name, index) => sourceNames.indexOf(name) !== index
  );
  const conflicts = [...new Set(sourceNames.filter((name) => targetNames.has(name)))];

  if (duplicateSourceNames.length > 0 || conflicts.length > 0) {
    const details = [
      duplicateSourceNames.length > 0
        ? `duplicate source names: ${[...new Set(duplicateSourceNames)].join(', ')}`
        : null,
      conflicts.length > 0
        ? `names already owned by Wray: ${conflicts.join(', ')}`
        : null,
    ].filter(Boolean).join('; ');

    throw new Error(`Cannot migrate ${label}: ${details}. Resolve conflicts first.`);
  }

  return {
    total: await Model.countDocuments(),
    sourceIds: sourceDocuments.map((document) => document._id),
  };
};

try {
  const wray = await findTargetUser();
  const [postPlan, categoryPlan, tagPlan] = await Promise.all([
    getMigrationPlan(Post, 'posts', wray._id),
    getMigrationPlan(CategoryTag, 'category tags', wray._id),
    getMigrationPlan(Tag, 'tags', wray._id),
  ]);

  const [postResult, categoryResult, tagResult] = await Promise.all([
    Post.updateMany(
      { _id: { $in: postPlan.sourceIds } },
      { $set: { author: wray._id } }
    ),
    CategoryTag.updateMany(
      { _id: { $in: categoryPlan.sourceIds } },
      { $set: { author: wray._id } }
    ),
    Tag.updateMany(
      { _id: { $in: tagPlan.sourceIds } },
      { $set: { author: wray._id } }
    ),
  ]);

  const [wrayPostsAfterMigration, wrayCategoriesAfterMigration, wrayTagsAfterMigration] =
    await Promise.all([
      Post.countDocuments({ author: wray._id }),
      CategoryTag.countDocuments({ author: wray._id }),
      Tag.countDocuments({ author: wray._id }),
    ]);

  console.log(JSON.stringify({
    targetUser: {
      id: wray._id,
      username: wray.username,
      nickname: wray.nickname,
      role: wray.role,
    },
    posts: {
      total: postPlan.total,
      migrated: postResult.modifiedCount,
      wrayAfterMigration: wrayPostsAfterMigration,
    },
    categoryTags: {
      total: categoryPlan.total,
      migrated: categoryResult.modifiedCount,
      wrayAfterMigration: wrayCategoriesAfterMigration,
    },
    tags: {
      total: tagPlan.total,
      migrated: tagResult.modifiedCount,
      wrayAfterMigration: wrayTagsAfterMigration,
    },
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
