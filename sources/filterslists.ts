import * as Workerpool from 'workerpool'
import * as Glob from 'glob'
import * as EsToolkit from 'es-toolkit'
import * as AGTree from '@adguard/agtree'
import * as Fs from 'node:fs'
import * as Process from 'node:process'
import * as Url from 'node:url'

const Dirname = Url.fileURLToPath(new URL('.', import.meta.url))

export class FiltersLists {
  protected Filenames: string[] = []
  protected FilenamesPatterns: string[]
  protected Filters: string[] = []
  protected FiltersParsed: AGTree.AnyRule[] = []
  protected Domains: string[] = []

  constructor(FilenamesPatterns: string[]) {
    this.Filenames = []
    this.FilenamesPatterns = FilenamesPatterns
  }

  async IndexFiltersLists() {
    for (let Patterns of this.FilenamesPatterns) {
      let Files = await Glob.glob(Patterns, { ignore: 'node_modules/**' })
      this.Filenames.push(...Files)
    }
  }

  async ParseFiltersLists(AdblockType: { ABP?: boolean, UBO?: boolean }) {
    let WorkerpoolInstance = Workerpool.pool(Dirname + 'worker/filters.mjs')
    for (let Filename of this.Filenames) {
      this.Filters.push(...Fs.readFileSync(Filename, 'utf8').split(Process.platform === 'win32' ? '\r\n' : '\n'))
    }

    let FiltersParserPromises: ReturnType<typeof WorkerpoolInstance.exec>[] = [] 
    for (let Filter of EsToolkit.chunk(this.Filters, 1)) {
      let FiltersParserPromise = WorkerpoolInstance.exec('ParseFilters', [Filter[0], AdblockType]).then(Results => {
        if (Results) {
          this.FiltersParsed.push(Results as AGTree.AnyRule)
        }
      })
      FiltersParserPromises.push(FiltersParserPromise)
    }
    await Promise.all(FiltersParserPromises)
  }

  async GetAllDomains() {
    let WorkerpoolInstance = Workerpool.pool(Dirname + 'worker/filters.mjs')
    let FiltersParserPromises: ReturnType<typeof WorkerpoolInstance.exec>[] = [] 
    for (let Filter of this.FiltersParsed) {
      let DomainsParserPromise = WorkerpoolInstance.exec('ParseDomains', [Filter]).then(Results => this.Domains.push(...Results as string[]))
      FiltersParserPromises.push(DomainsParserPromise)
    }
    await Promise.all(FiltersParserPromises)
    return Array.from(new Set(this.Domains)).filter(Domain => !Domain.includes('*'))
  }
}