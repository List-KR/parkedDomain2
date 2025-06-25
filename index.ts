import { RunPrompts } from './prompts.js'
import { RunCommander } from './commander.js'
import * as Process from 'node:process'

if (Process.argv.length === 0) {
  await RunPrompts()
} else {
  await RunCommander()
}