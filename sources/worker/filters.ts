import * as Workerpool from 'workerpool'
import * as ParseDomain from 'parse-domain'
import * as AGTree from '@adguard/agtree'

let DomainRegExp = /[0-9a-zA-Z-\.]+\.[0-9a-zA-Z]+(\.\*)?/g

async function ParseFilters(Filters: string, AdblockType: { ABP?: boolean, UBO?: boolean }) {
  try {
    return AGTree.RuleParser.parse(Filters, { parseAbpSpecificRules: AdblockType.ABP ?? false, parseUboSpecificRules: AdblockType.UBO ?? false })
  }
  catch {
    return null
  }
}

async function ParseDomains(Filter: AGTree.AnyRule) {
  let Domains: string[] = []
  if (Filter.type === 'InvalidRule' || Filter.type === 'CommentRule' || Filter.type === 'EmptyRule') {
    return Domains
  }
  if (Filter.type === 'NetworkRule' && DomainRegExp.test(Filter.pattern.value)) {
    Domains.push(...Filter.pattern.value.match(DomainRegExp))
    if (Filter.modifiers && Filter.modifiers.children) {
      for (let Modifier of Filter.modifiers.children.filter(Child => Child.name.value === 'domain')) {
        Modifier.value.value.match(DomainRegExp)?.forEach(Domain => Domains.push(Domain))
      }
    }
  }
  if (Filter.type === 'CssInjectionRule' && Filter.domains.children.length > 0) {
    Domains.push(...Filter.domains.children.map(Domain => Domain.value))
  }
  if (Filter.type === 'ElementHidingRule' && Filter.domains.children.length > 0) {
    Domains.push(...Filter.domains.children.map(Domain => Domain.value))
  }
  if (Filter.type === 'HtmlFilteringRule' && Filter.domains.children.length > 0) {
    Domains.push(...Filter.domains.children.map(Domain => Domain.value))
  }
  if (Filter.type === 'JsInjectionRule' && Filter.domains.children.length > 0) {
    Domains.push(...Filter.domains.children.map(Domain => Domain.value))
  }
  if (Filter.type === 'ScriptletInjectionRule' && Filter.domains.children.length > 0) {
    Domains.push(...Filter.domains.children.map(Domain => Domain.value))
  }
  return Domains.filter(Domain => !Domain.includes('*')).map(Domain => {
    let ParsedDomain = ParseDomain.parseDomain(Domain)
    if (ParsedDomain.type === ParseDomain.ParseResultType.Listed) {
      return ParsedDomain.icann.domain + '.' + ParsedDomain.icann.topLevelDomains.join('.')
    }
  })
}

Workerpool.worker({
  ParseFilters: ParseFilters,
  ParseDomains: ParseDomains
})