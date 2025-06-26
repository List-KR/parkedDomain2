import ora from 'ora'
import * as Prompts from '@inquirer/prompts'
import * as Glob from 'glob'
import * as ESToolkit from 'es-toolkit'
import { FiltersLists } from './sources/filterslists.js'
import { DnsClient } from './sources/dns.js'
import * as Fs from 'node:fs'

export async function RunPrompts() {
  const FilenamesPatterns = await Prompts.input({
    message: 'Enter the filenames patterns about filters lists (glob syntax)',
    required: true,
    validate: async Input => (await Glob.glob(Input, { ignore: 'node_modules/**' })).length > 0 ? true : 'No files found with this pattern'
  })
  const AdblockType = await Prompts.select({
    message: 'Select the adblock syntax type',
    choices: [
      {
        name: 'AdGuard',
        value: { ABP: false, UBO: false }
      },
      {
        name: 'uBlock Origin',
        value: { ABP: false, UBO: true }
      }, {
        name: 'Adblock Plus',
        value: { ABP: true, UBO: false }
      }
    ],
    loop: true
  })
  const ParkedNSDomains: string[] = (await Prompts.input({
    message: 'Enter the namespace domains that manage a parked domain (comma separated)',
    required: false,
    validate: Input => Input.split(',').map(Domain => Domain.trim()).every(Domain => /^[0-9a-zA-Z-\.]+\.[0-9a-zA-Z]+$/.test(Domain)) ? true : 'Invalid domain format',
    default: 'parklogic.com,giantpanda.com,parkingcrew.net',
  })).split(',').map(Domain => Domain.trim())
  const OutputFile = await Prompts.input({
    message: 'Enter the output file path (leave empty to print to console)',
    required: false
  })

  const Spinner = ora('Getting Started...').start()
  const FiltersListsInstance = new FiltersLists([FilenamesPatterns])
  Spinner.text = 'Searching for filters lists files matching the patterns...'
  await FiltersListsInstance.IndexFiltersLists()
  Spinner.text = 'Parsing filters lists...'
  await FiltersListsInstance.ParseFiltersLists(AdblockType)
  Spinner.text = 'Getting all domains from filters lists...'
  const Domains = await FiltersListsInstance.GetAllDomains()
  let ParkedDomains: string[] = []
  for (let I = 0; I < Domains.length; I++) {
    Spinner.text = `Checking domain ${Domains[I]} (${I + 1} of ${Domains.length} items)...`
    const DnsClientInstance = new DnsClient(Domains[I])
    for (let Record of (await DnsClientInstance.LookupNSRecords()) ?? []) {
      if (ParkedNSDomains.some(ParkedNSDomain => Record.includes(ParkedNSDomain))) {
        ParkedDomains.push(Domains[I])
        break
      }
    }
  }
  Spinner.text = 'Finished checking domains.'
  Spinner.succeed()
  ParkedDomains = ESToolkit.uniq(ParkedDomains)
  if (OutputFile === ''){
    console.log(ParkedDomains)
  } else {
    Fs.writeFileSync(OutputFile, ParkedDomains.join('\n'), 'utf8')
  }
}