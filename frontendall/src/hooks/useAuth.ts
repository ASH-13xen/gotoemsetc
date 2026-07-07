import { useMutation } from '@tanstack/react-query'
import { login, type LoginInput } from '@/api/auth.api'
import { useAuthContext } from '@/context/AuthContext'

export function useAuth() {
  return useAuthContext()
}

export function useLogin() {
  const { signIn } = useAuthContext()
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (data) => {
      signIn(data.token, data.user)
    },
  })
}
