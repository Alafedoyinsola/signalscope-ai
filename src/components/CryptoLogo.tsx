import { useState } from 'react'

interface CryptoLogoProps {
  id?: number | null
  symbol: string
  name?: string
  size?: number
  className?: string
}

// Well-known CoinMarketCap IDs for top digital assets when ID is not provided
const KNOWN_CMC_IDS: Record<string, number> = {
  BTC: 1,
  ETH: 1027,
  USDT: 825,
  BNB: 1839,
  SOL: 5426,
  XRP: 52,
  USDC: 3408,
  DOGE: 74,
  ADA: 2010,
  AVAX: 5805,
  TRX: 1958,
  LINK: 1975,
  SUI: 20947,
  DOT: 6636,
  NEAR: 6535,
  LEO: 3957,
  DAI: 4943,
  LTC: 2,
  PEPE: 24478,
  UNI: 7083,
  APT: 21794,
  POL: 28321,
  XLM: 512,
  ICP: 8916,
  SHIB: 5994,
  HBAR: 4642,
  RENDER: 5690,
  KAS: 20396,
  MNT: 27075,
  ARB: 11841,
  OP: 11840,
  FIL: 2280,
  AAVE: 7278,
  TAO: 22974,
  ATOM: 3794,
  INJ: 7226,
  VET: 3077,
}

export function CryptoLogo({
  id,
  symbol,
  name,
  size = 24,
  className = '',
}: CryptoLogoProps) {
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({})

  const cmcId = id ?? KNOWN_CMC_IDS[symbol.toUpperCase()]
  const primaryUrl = cmcId
    ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`
    : null
  const secondaryUrl = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`

  const candidateUrls = [primaryUrl, secondaryUrl].filter(Boolean) as string[]
  const currentSrc = candidateUrls.find((url) => !failedUrls[url]) ?? null

  const handleError = () => {
    if (currentSrc) {
      setFailedUrls((prev) => ({ ...prev, [currentSrc]: true }))
    }
  }

  const fallbackText =
    symbol.length > 4 ? symbol.slice(0, 3).toUpperCase() : symbol.toUpperCase()

  return (
    <div
      className={`crypto-logo-wrapper ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
      }}
      title={name ? `${name} (${symbol})` : symbol}
      aria-label={name ? `${name} logo` : `${symbol} logo`}
    >
      {currentSrc ? (
        <img
          src={currentSrc}
          alt={name ? `${name} logo` : `${symbol} logo`}
          className="crypto-logo-img"
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={handleError}
        />
      ) : (
        <div
          className="crypto-logo-fallback font-mono"
          style={{ fontSize: `${Math.max(7, Math.round(size * 0.36))}px` }}
        >
          {fallbackText}
        </div>
      )}
    </div>
  )
}
