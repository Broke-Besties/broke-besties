import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

type UserAvatarProps = {
  name: string
  profilePictureUrl?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UserAvatar({
  name,
  profilePictureUrl,
  className,
  size = 'md',
}: UserAvatarProps) {
  const initials = getInitials(name)

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {profilePictureUrl && (
        <AvatarImage src={profilePictureUrl} alt={name} />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
