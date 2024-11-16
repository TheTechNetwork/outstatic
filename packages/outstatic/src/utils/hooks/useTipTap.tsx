import { TiptapExtensions } from '@/utils/editor/extensions'
import { TiptapEditorProps } from '@/utils/editor/props'
import { getPrevText } from '@/utils/editor/utils/getPrevText'
import Placeholder from '@tiptap/extension-placeholder'
import { Editor, EditorEvents, useEditor } from '@tiptap/react'
import { useCompletion } from 'ai/react'
import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useDebouncedCallback } from 'use-debounce'
import useOutstatic from './useOutstatic'
import { OUTSTATIC_API_PATH } from '../constants'
import { useCsrfToken } from './useCsrfToken'

const useTipTap = ({ ...rhfMethods }) => {
  const { hasOpenAIKey, basePath } = useOutstatic()
  const csrfToken = useCsrfToken()
  const { setValue, trigger } = rhfMethods

  const editorRef = useRef<Editor | null>(null)

  const debouncedCallback = useDebouncedCallback(async ({ editor }) => {
    const val = editor.getHTML()
    setValue('content', val && !editor.isEmpty ? val : '')
  }, 500)

  const { complete, completion, isLoading, stop } = useCompletion({
    id: 'outstatic',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
    api: basePath + OUTSTATIC_API_PATH + '/generate',
    onFinish: (_prompt, completion) => {
      if (editorRef.current) {
        editorRef.current.commands.setTextSelection({
          from: editorRef.current.state.selection.from - completion.length,
          to: editorRef.current.state.selection.from
        })
      }
    },
    onError: (err) => {
      toast.error(err.message)
    }
  })
  const onUpdate = useCallback(
    ({ editor }: EditorEvents['update']) => {
      const selection = editor.state.selection
      const lastTwo = getPrevText(editor, {
        chars: 2
      })
      if (hasOpenAIKey && lastTwo === '++' && !isLoading) {
        editor.commands.deleteRange({
          from: selection.from - 2,
          to: selection.from
        })
        const prevText = getPrevText(editor, { chars: 5000 })

        if (prevText === '') {
          toast.error('Write some content so the AI can continue.')
        } else {
          complete(prevText)
        }
      } else {
        debouncedCallback({ editor })
      }
    },
    [hasOpenAIKey, isLoading, complete, debouncedCallback]
  )

  const editor = useEditor({
    extensions: [
      ...TiptapExtensions,
      Placeholder.configure({
        placeholder: ({ editor, node }) => {
          if (editor.isActive('tableCell') || editor.isActive('tableHeader')) {
            return ''
          }

          if (node.type.name === 'heading') {
            return `Heading ${node.attrs.level}`
          }

          return `Press '/' for commands${
            hasOpenAIKey ? ", or '++' for AI autocomplete..." : ''
          }`
        },
        includeChildren: true
      })
    ],
    editorProps: TiptapEditorProps,
    onUpdate
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  const prev = useRef('')

  useEffect(() => {
    editor?.commands.toggleClass('completing')
  }, [isLoading])

  // Insert chunks of the generated text
  useEffect(() => {
    const diff = completion.slice(prev.current.length)
    prev.current = completion

    try {
      editor?.commands.insertContent(diff)
    } catch (e) {
      console.log(`error adding content: ${diff}`)
    }
  }, [isLoading, editor, completion])

  useEffect(() => {
    // if user presses escape or cmd + z and it's loading,
    // stop the request, delete the completion, and insert back the "++"
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.metaKey && e.key === 'z')) {
        stop()
        if (e.key === 'Escape') {
          editor?.commands.deleteRange({
            from: editor.state.selection.from - completion.length,
            to: editor.state.selection.from
          })
          toast.message('AI writing cancelled.')
        }
      }
    }
    const mousedownHandler = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      stop()
      if (window.confirm('AI writing paused. Continue?')) {
        complete(editor?.getText() || '')
      }
    }
    if (isLoading) {
      document.addEventListener('keydown', onKeyDown)
      window.addEventListener('mousedown', mousedownHandler)
    } else {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', mousedownHandler)
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', mousedownHandler)
    }
  }, [stop, isLoading, editor, complete, completion.length])

  return { editor: editor as Editor }
}

export default useTipTap
