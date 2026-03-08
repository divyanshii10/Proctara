// ============================================
// Proctara Code Execution Sandbox Service
// Secure, sandboxed code execution via Docker
// ============================================

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../lib/logger';

const execAsync = promisify(exec);

// ---- Types ----

interface ExecutionRequest {
  language: 'javascript' | 'python' | 'java' | 'cpp' | 'go';
  sourceCode: string;
  testCases: Array<{
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }>;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

interface ExecutionResult {
  passed: number;
  failed: number;
  total: number;
  executionTimeMs: number;
  memoryKb: number;
  details: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    executionTimeMs: number;
    error?: string;
  }>;
  compilationError?: string;
}

// Language configs
const LANGUAGE_CONFIG = {
  javascript: {
    image: 'node:20-alpine',
    extension: '.js',
    runCmd: (file: string) => `node ${file}`,
    compileCmd: null,
  },
  python: {
    image: 'python:3.12-alpine',
    extension: '.py',
    runCmd: (file: string) => `python3 ${file}`,
    compileCmd: null,
  },
  java: {
    image: 'eclipse-temurin:21-alpine',
    extension: '.java',
    runCmd: (_file: string) => `java Main`,
    compileCmd: (file: string) => `javac ${file}`,
  },
  cpp: {
    image: 'gcc:13-bookworm',
    extension: '.cpp',
    runCmd: (_file: string) => `./a.out`,
    compileCmd: (file: string) => `g++ -std=c++17 -O2 -o a.out ${file}`,
  },
  go: {
    image: 'golang:1.22-alpine',
    extension: '.go',
    runCmd: (file: string) => `go run ${file}`,
    compileCmd: null,
  },
};

/**
 * Execute code in a secured Docker container with resource limits.
 * 
 * Security measures:
 * - No network access (--network none)
 * - Memory limit (256MB default)
 * - CPU time limit (10s default)
 * - Read-only filesystem
 * - No privilege escalation
 * - Temporary container (--rm)
 */
export async function executeCode(request: ExecutionRequest): Promise<ExecutionResult> {
  const {
    language,
    sourceCode,
    testCases,
    timeoutMs = 10000,
    memoryLimitMb = 256,
  } = request;

  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    throw new Error(`Unsupported language: ${language}`);
  }

  const executionId = uuidv4();
  const tmpDir = join(process.cwd(), 'tmp', 'sandbox', executionId);

  try {
    // Create temp directory and write source file
    mkdirSync(tmpDir, { recursive: true });
    const fileName = language === 'java' ? 'Main.java' : `solution${config.extension}`;
    const filePath = join(tmpDir, fileName);
    writeFileSync(filePath, sourceCode);

    const results: ExecutionResult = {
      passed: 0,
      failed: 0,
      total: testCases.length,
      executionTimeMs: 0,
      memoryKb: 0,
      details: [],
    };

    // Compile if needed (Java, C++)
    if (config.compileCmd) {
      try {
        await execAsync(
          `docker run --rm --network none --memory=${memoryLimitMb}m ` +
          `--cpus=1 --pids-limit=50 --read-only ` +
          `--tmpfs /tmp:rw,size=64m ` +
          `-v "${tmpDir}:/code:rw" -w /code ` +
          `${config.image} ${config.compileCmd(fileName)}`,
          { timeout: timeoutMs }
        );
      } catch (err: unknown) {
        const error = err as { stderr?: string };
        results.compilationError = error.stderr || 'Compilation failed';
        results.failed = testCases.length;
        return results;
      }
    }

    // Run each test case
    const startTime = Date.now();

    for (const testCase of testCases) {
      const tcStart = Date.now();

      try {
        // Write input to a temp file
        const inputPath = join(tmpDir, 'input.txt');
        writeFileSync(inputPath, testCase.input);

        const { stdout, stderr } = await execAsync(
          `docker run --rm --network none --memory=${memoryLimitMb}m ` +
          `--cpus=1 --pids-limit=50 --read-only ` +
          `--tmpfs /tmp:rw,size=64m ` +
          `-v "${tmpDir}:/code:ro" -w /code ` +
          `${config.image} sh -c "${config.runCmd(fileName)} < input.txt"`,
          { timeout: timeoutMs }
        );

        const actualOutput = stdout.trim();
        const expectedOutput = testCase.expectedOutput.trim();
        const passed = actualOutput === expectedOutput;

        results.details.push({
          input: testCase.isHidden ? '[hidden]' : testCase.input,
          expectedOutput: testCase.isHidden ? '[hidden]' : expectedOutput,
          actualOutput: testCase.isHidden ? (passed ? '[correct]' : '[incorrect]') : actualOutput,
          passed,
          executionTimeMs: Date.now() - tcStart,
          error: stderr || undefined,
        });

        if (passed) results.passed++;
        else results.failed++;
      } catch (err: unknown) {
        const error = err as { killed?: boolean; stderr?: string };
        results.failed++;
        results.details.push({
          input: testCase.isHidden ? '[hidden]' : testCase.input,
          expectedOutput: testCase.isHidden ? '[hidden]' : testCase.expectedOutput,
          actualOutput: '',
          passed: false,
          executionTimeMs: Date.now() - tcStart,
          error: error.killed ? 'Time Limit Exceeded' : (error.stderr || 'Runtime Error'),
        });
      }
    }

    results.executionTimeMs = Date.now() - startTime;

    logger.info({
      executionId,
      language,
      passed: results.passed,
      total: results.total,
      timeMs: results.executionTimeMs,
    }, 'Code execution completed');

    return results;
  } finally {
    // Clean up temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      logger.warn({ executionId }, 'Failed to clean up sandbox directory');
    }
  }
}
