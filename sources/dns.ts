import got from 'got'

let HttpsClient = got.extend({
  http2: true,
  headers: {
    'User-Agent': 'parkedDomain2',
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

function ReinitHttpsClient() {
  HttpsClient = got.extend({
  http2: true,
  headers: {
    'User-Agent': 'parkedDomain2',
    accept: 'application/dns-json'
  },
  https: {
    minVersion: 'TLSv1.3',
    ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256'
  },
  throwHttpErrors: false
})
}

export class DnsClient {
  protected Domain: string
  protected DomainRecords: DnsResponse = {
    NS: null
  }

  constructor(Domain: string) {
    this.Domain = Domain
  }

  async LookupNSRecords() {
    let HttpsResponse: CloudflareDnsResponse<'NS'>
    try {
      HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=NS`)).body) as CloudflareDnsResponse<'NS'>
    }
    catch {
      ReinitHttpsClient()
      HttpsResponse = JSON.parse((await HttpsClient(`https://cloudflare-dns.com/dns-query?name=${this.Domain}&type=NS`)).body) as CloudflareDnsResponse<'NS'>
    }
    if (HttpsResponse.Answer) {
      this.DomainRecords.NS = HttpsResponse.Answer.map((Record) => Record.data)
    }
    return this.DomainRecords.NS
  }
}