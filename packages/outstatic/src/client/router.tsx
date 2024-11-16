import { AdminLoading } from '@/components/AdminLoading'
import { useCollections } from '@/utils/hooks/useCollections'
import useOutstatic from '@/utils/hooks/useOutstatic'
import { ReactElement } from 'react'
import CustomFields from './pages/custom-fields'
import Collections from './pages/collections'
import EditDocument from './pages/edit-document'
import List from './pages/list'
import NewCollection from './pages/new-collection'
import Settings from './pages/settings'
import MediaLibrary from './pages/media-library'

const defaultPages: { [key: string]: ReactElement | undefined } = {
  settings: <Settings />,
  'media-library': <MediaLibrary />,
  collections: undefined
}

export const Router = ({ params }: { params: { ost: string[] } }) => {
  const { data: collections, isPending, fetchStatus } = useCollections()

  const { pages } = useOutstatic()

  const slug = params?.ost?.[0] || ''
  const slug2 = params?.ost?.[1] || ''

  if (isPending && fetchStatus !== 'idle') return <AdminLoading />

  const isContent = slug && ![...pages].includes(slug)

  const title =
    collections?.find((col) => col.slug === slug || col.slug === slug2)
      ?.title || ''

  return (
    <>
      {!slug ? (
        <Collections />
      ) : slug2 && isContent ? (
        <EditDocument collection={slug} />
      ) : !slug2 && isContent ? (
        <List slug={slug} title={title} />
      ) : slug === 'collections' &&
        collections?.find((col) => col.slug === slug2) ? (
        <CustomFields collection={slug2} title={title} />
      ) : !!slug2 && !isContent ? (
        <NewCollection />
      ) : (
        defaultPages[slug]
      )}
    </>
  )
}
