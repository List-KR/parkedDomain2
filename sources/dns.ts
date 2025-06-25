import got from 'got'

const HttpsClient = got.extend({
  http2: true,
  headers: {
    'User-Agent': 'sendmail-pgp',
    accept: 'application/dns-json'
  },
  https: {
    minVersion: 'TLSv1.3',
    ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256'
  },
  throwHttpErrors: false
})

export type DnsResponse = {
  CNAME: string
  NS: string[]
  A?: never
  AAAA?: never
  TXT?: never
  MX?: never
  TLSA?: never
} | {
  A?: string[]
  AAAA?: string[]
  NS: string[]
  TXT?: string[]
  MX?: {
    Exchange: string
    Priority: number
  }[]
  TLSA?: {
    Usage: number
    Selector: number
    MatchingType: number
    CertificateAssociationData: string
  }[]
  CNAME?: never
}

type CloudflareDnsTypeCommonContainer = {
  Status: number
  TC: boolean
  RD: boolean
  RA: boolean
  AD: boolean
  CD: boolean
  Question: Array<{
    // eslint-disable-next-line @typescript-eslint/naming-convention
    name: string
    // eslint-disable-next-line @typescript-eslint/naming-convention
    type: number
  }>
  Answer: Array<{
    // eslint-disable-next-line @typescript-eslint/naming-convention
    name: string
    // eslint-disable-next-line @typescript-eslint/naming-convention
    type: number
    TTL: number
    // eslint-disable-next-line @typescript-eslint/naming-convention
    data: string
  }>
}

type CloudflareDnsTypeAuthContainer = {
  Status: number
  TC: boolean
  RD: boolean
  RA: boolean
  AD: boolean
  CD: boolean
  Question: Array<{
    // eslint-disable-next-line @typescript-eslint/naming-convention
    name: string
    // eslint-disable-next-line @typescript-eslint/naming-convention
    type: number
  }>
  Authority: Array<{
    // eslint-disable-next-line @typescript-eslint/naming-convention
    name: string
    // eslint-disable-next-line @typescript-eslint/naming-convention
    type: number
    TTL: number
    // eslint-disable-next-line @typescript-eslint/naming-convention
    data: string
  }>
}

type CloudflareDnsResponse<T extends 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'TLSA' | 'NS'> = {
  Name: string
  Type: T
} & {
  A: CloudflareDnsTypeCommonContainer & CloudflareDnsTypeAuthContainer
  AAAA: CloudflareDnsTypeCommonContainer & CloudflareDnsTypeAuthContainer
  CNAME: CloudflareDnsTypeCommonContainer & CloudflareDnsTypeAuthContainer
  TXT: CloudflareDnsTypeCommonContainer & CloudflareDnsTypeAuthContainer
  MX: CloudflareDnsTypeCommonContainer & CloudflareDnsTypeAuthContainer
  TLSA: CloudflareDnsTypeCommonContainer & CloudflareDnsTypeAuthContainer
  NS: CloudflareDnsTypeCommonContainer
}[T]

export class DnsClient {
  protected Domain: string
  protected DomainRecords: DnsResponse = {
    NS: null
  }

  constructor(Domain: string) {
    this.Domain = Domain
  }

  protected async LookupARecords() {
    let HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=A`)).body) as CloudflareDnsResponse<'A'>
    if (HttpsResponse.Answer) {
      this.DomainRecords.A.push(...HttpsResponse.Answer.map((Record) => Record.data))
    }
  }

  protected async LookupAAAARecords() {
    let HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=AAAA`)).body) as CloudflareDnsResponse<'AAAA'>
    if (HttpsResponse.Answer) {
      this.DomainRecords.AAAA.push(...HttpsResponse.Answer.map((Record) => Record.data))
    }
  }

  protected async LookupTXTRecords() {
    let HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=TXT`)).body) as CloudflareDnsResponse<'TXT'>
    if (HttpsResponse.Answer) {
      this.DomainRecords.TXT.push(...HttpsResponse.Answer.map((Record) => Record.data))
    }
  }

  protected async LookupMXRecords() {
    let HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=MX`)).body) as CloudflareDnsResponse<'MX'>
    if (HttpsResponse.Answer) {
      this.DomainRecords.MX.push(...HttpsResponse.Answer.map((Record) => ({
        Exchange: Record.data.split(' ')[1],
        Priority: parseInt(Record.data.split(' ')[0], 10)
      })))
    }
  }

  protected async LookupTLSARecords() {
    let HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=TLSA`)).body) as CloudflareDnsResponse<'TLSA'>
    if (HttpsResponse.Answer) {
      this.DomainRecords.TLSA.push(...HttpsResponse.Answer.map((Record) => ({
        Usage: parseInt(Record.data.split(' ')[0], 10),
        Selector: parseInt(Record.data.split(' ')[1], 10),
        MatchingType: parseInt(Record.data.split(' ')[2], 10),
        CertificateAssociationData: Record.data.split(' ')[3]
      })))
    }
  }

  protected async LookupCNAMERecords() {
    let HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=CNAME`)).body) as CloudflareDnsResponse<'CNAME'>
    if (HttpsResponse.Answer) {
      this.DomainRecords.CNAME = HttpsResponse.Answer.map((Record) => Record.data)[0]
    }
  }

  protected async LookupNSRecords() {
    let HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=NS`)).body) as CloudflareDnsResponse<'NS'>
    this.DomainRecords.NS = HttpsResponse.Answer.map((Record) => Record.data)
  }

  async LookupRecords() {
    await Promise.all([this.LookupCNAMERecords(), this.LookupNSRecords()])
    if (this.DomainRecords.CNAME) {
      return this.DomainRecords
    }
    this.DomainRecords = {
      A: [],
      AAAA: [],
      TXT: [],
      MX: [],
      TLSA: [],
      NS: this.DomainRecords.NS,
    }
    await Promise.all([
      this.LookupARecords(),
      this.LookupAAAARecords(),
      this.LookupTXTRecords(),
      this.LookupMXRecords(),
      this.LookupTLSARecords()
    ])
    return this.DomainRecords
  }
}