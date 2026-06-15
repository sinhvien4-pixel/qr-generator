export type QRType = 'url' | 'text' | 'email' | 'phone' | 'wifi'

export interface WiFiConfig {
  ssid: string
  password: string
  encryption: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
}

export interface QRRecord {
  id?: string
  type: QRType
  value: string
  fgColor: string
  bgColor: string
  size: number
  createdAt: Date
}
