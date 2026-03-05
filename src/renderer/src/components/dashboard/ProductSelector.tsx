import { ChevronDown } from 'lucide-react'

export const PRODUCTS = [
  'Receiver',
  'WpfClient',
  'PosServer',
  'CustomerServiceApplication'
] as const

export type ProductName = (typeof PRODUCTS)[number]

const PRODUCT_LABELS: Record<ProductName, string> = {
  Receiver: 'Receiver',
  WpfClient: 'WPF Client',
  PosServer: 'POS Server',
  CustomerServiceApplication: 'CSA'
}

interface ProductSelectorProps {
  value: ProductName
  onChange: (product: ProductName) => void
  products?: readonly ProductName[]
}

export function ProductSelector({
  value,
  onChange,
  products = PRODUCTS
}: ProductSelectorProps): React.ReactNode {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ProductName)}
        className="appearance-none rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm text-foreground transition-colors hover:border-accent focus:border-accent focus:outline-none"
      >
        {products.map((p) => (
          <option key={p} value={p}>
            {PRODUCT_LABELS[p]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
      />
    </div>
  )
}

export function getProductLabel(product: ProductName): string {
  return PRODUCT_LABELS[product]
}
