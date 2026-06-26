import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with coding challenges...');

  // 1. Two Sum
  const twoSumContent = `# Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.
You may assume that each input would have exactly one solution, and you may not use the same element twice.
You can return the answer in any order.

### Input Format:
Line 1: A JSON array of integers, e.g. \`[2,7,11,15]\`
Line 2: An integer representing the target, e.g. \`9\`

### Output Format:
A JSON array of two indices, e.g. \`[0,1]\`

### Example 1:
**Input:**
\`\`\`
[2,7,11,15]
9
\`\`\`
**Output:**
\`\`\`
[0,1]
\`\`\``;
  const twoSumTestCases = [
    { input: "[2,7,11,15]\n9", expectedOutput: "[0,1]", isHidden: false },
    { input: "[3,2,4]\n6", expectedOutput: "[1,2]", isHidden: false },
    { input: "[3,3]\n6", expectedOutput: "[0,1]", isHidden: true },
    { input: "[1,5,9,3,7]\n10", expectedOutput: "[3,4]", isHidden: true }
  ];

  await prisma.question.upsert({
    where: { id: 'a0000000-0000-0000-0000-000000000001' },
    update: {
      content: twoSumContent,
      testCases: twoSumTestCases,
      difficulty: 'medium',
      topic: 'Arrays',
    },
    create: {
      id: 'a0000000-0000-0000-0000-000000000001',
      type: 'coding',
      difficulty: 'medium',
      topic: 'Arrays',
      content: twoSumContent,
      testCases: twoSumTestCases,
    }
  });

  // 2. Reverse a String
  const reverseStringContent = `# Reverse a String

Write a function that reverses a string. The input string is given as a string.

### Input Format:
A single string, e.g. \`hello\`

### Output Format:
The reversed string, e.g. \`olleh\`

### Example 1:
**Input:**
\`\`\`
hello
\`\`\`
**Output:**
\`\`\`
olleh
\`\`\``;
  const reverseStringTestCases = [
    { input: "hello", expectedOutput: "olleh", isHidden: false },
    { input: "world", expectedOutput: "dlrow", isHidden: false },
    { input: "Proctara", expectedOutput: "aratcorP", isHidden: true }
  ];

  await prisma.question.upsert({
    where: { id: 'a0000000-0000-0000-0000-000000000002' },
    update: {
      content: reverseStringContent,
      testCases: reverseStringTestCases,
      difficulty: 'easy',
      topic: 'Strings',
    },
    create: {
      id: 'a0000000-0000-0000-0000-000000000002',
      type: 'coding',
      difficulty: 'easy',
      topic: 'Strings',
      content: reverseStringContent,
      testCases: reverseStringTestCases,
    }
  });

  // 3. Valid Parentheses
  const validParenthesesContent = `# Valid Parentheses

Given a string \`s\` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.
An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

### Input Format:
A single string, e.g. \`()[]{}\`

### Output Format:
\`true\` or \`false\`

### Example 1:
**Input:**
\`\`\`
()[]{}
\`\`\`
**Output:**
\`\`\`
true
\`\`\``;
  const validParenthesesTestCases = [
    { input: "()[]{}", expectedOutput: "true", isHidden: false },
    { input: "(]", expectedOutput: "false", isHidden: false },
    { input: "({[]})", expectedOutput: "true", isHidden: true },
    { input: "([)]", expectedOutput: "false", isHidden: true }
  ];

  await prisma.question.upsert({
    where: { id: 'a0000000-0000-0000-0000-000000000003' },
    update: {
      content: validParenthesesContent,
      testCases: validParenthesesTestCases,
      difficulty: 'easy',
      topic: 'Stacks',
    },
    create: {
      id: 'a0000000-0000-0000-0000-000000000003',
      type: 'coding',
      difficulty: 'easy',
      topic: 'Stacks',
      content: validParenthesesContent,
      testCases: validParenthesesTestCases,
    }
  });

  // 4. Merge Sorted Arrays
  const mergeSortedContent = `# Merge Sorted Arrays

Given two sorted integer arrays \`nums1\` and \`nums2\`, merge \`nums2\` into \`nums1\` as one sorted array.
Note: You can assume that \`nums1\` has a size equal to \`m + n\` (where m is the size of elements in nums1, n is size of nums2).

### Input Format:
Line 1: A JSON array of nums1, e.g. \`[1,2,3,0,0,0]\`
Line 2: Size of elements in nums1, m, e.g. \`3\`
Line 3: A JSON array of nums2, e.g. \`[2,5,6]\`
Line 4: Size of elements in nums2, n, e.g. \`3\`

### Output Format:
A JSON array representing the merged sorted array, e.g. \`[1,2,2,3,5,6]\`

### Example 1:
**Input:**
\`\`\`
[1,2,3,0,0,0]
3
[2,5,6]
3
\`\`\`
**Output:**
\`\`\`
[1,2,2,3,5,6]
\`\`\``;
  const mergeSortedTestCases = [
    { input: "[1,2,3,0,0,0]\n3\n[2,5,6]\n3", expectedOutput: "[1,2,2,3,5,6]", isHidden: false },
    { input: "[1]\n1\n[]\n0", expectedOutput: "[1]", isHidden: false },
    { input: "[0]\n0\n[1]\n1", expectedOutput: "[1]", isHidden: true },
    { input: "[4,5,6,0,0,0]\n3\n[1,2,3]\n3", expectedOutput: "[1,2,3,4,5,6]", isHidden: true }
  ];

  await prisma.question.upsert({
    where: { id: 'a0000000-0000-0000-0000-000000000004' },
    update: {
      content: mergeSortedContent,
      testCases: mergeSortedTestCases,
      difficulty: 'medium',
      topic: 'Two Pointers',
    },
    create: {
      id: 'a0000000-0000-0000-0000-000000000004',
      type: 'coding',
      difficulty: 'medium',
      topic: 'Two Pointers',
      content: mergeSortedContent,
      testCases: mergeSortedTestCases,
    }
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
