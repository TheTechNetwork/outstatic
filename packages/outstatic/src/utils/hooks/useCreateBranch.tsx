import { useMutation } from '@tanstack/react-query'
import { useOutstatic } from './useOutstatic'
import { CREATE_BRANCH } from '../../graphql/mutations/create-branch'
import { OID } from '@/graphql/queries/oid'
import { Commit } from '@/graphql/gql/graphql'

export const useCreateBranch = () => {
  const { repoOwner, repoSlug, repoBranch, gqlClient, session } = useOutstatic()

  return useMutation({
    mutationFn: async ({ branchName }: { branchName: string }) => {
      try {
        // Get repository info
        const { repository } = await gqlClient.request(OID, {
          owner: repoOwner || session?.user?.login || '',
          name: repoSlug,
          branch: repoBranch
        })

        if (!repository) {
          throw new Error('Repository not found')
        }

        const target = repository.ref?.target as Commit

        if (typeof target.history.nodes?.[0]?.oid !== 'string') {
          throw new Error('Received a non-string oid')
        }

        // Create the new branch
        const result = await gqlClient.request(CREATE_BRANCH, {
          repositoryId: repository.id,
          name: `refs/heads/${branchName}`,
          oid: target.history.nodes[0].oid
        })

        if (!result.createRef?.ref?.name) {
          throw new Error('Failed to create branch or branch reference')
        }

        return result.createRef.ref.name
      } catch (error) {
        console.error('Error creating branch:', error)
        throw error
      }
    }
  })
}
