import { cloneElement, isValidElement } from 'react'
import type { ReactNode } from 'react'
import type { Language } from './i18n'
import { translate } from './i18n'

type LocalizableProps = {
  children?: ReactNode
  placeholder?: string
  title?: string
  alt?: string
  'aria-label'?: string
  'aria-description'?: string
}

const localizeNode = (node: ReactNode, language: Language): ReactNode => {
  if (typeof node === 'string') return translate(node, language)
  if (Array.isArray(node)) {
    const children = node.map((child, index) => {
      const localized = localizeNode(child, language)
      return isValidElement(localized) && localized.key === null
        ? cloneElement(localized, { key: `locale-child-${index}` })
        : localized
    })
    return children.every((child, index) => child === node[index]) ? node : children
  }
  if (!isValidElement<LocalizableProps>(node)) return node

  const updates: Partial<LocalizableProps> = {}
  if (node.props.children !== undefined) {
    const children = localizeNode(node.props.children, language)
    if (children !== node.props.children) updates.children = children
  }
  for (const key of ['placeholder', 'title', 'alt', 'aria-label', 'aria-description'] as const) {
    const value = node.props[key]
    if (typeof value === 'string') {
      const localized = translate(value, language)
      if (localized !== value) updates[key] = localized
    }
  }
  return Object.keys(updates).length ? cloneElement(node, updates) : node
}

export function Localized({ language, children }: { language: Language; children: ReactNode }) {
  return <div className="locale-content" lang={language}>{localizeNode(children, language)}</div>
}
