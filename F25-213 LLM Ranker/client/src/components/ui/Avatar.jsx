import { User } from "lucide-react"
import { cn } from "@/lib/utils"

const Avatar = ({ src, alt = "User", size = "md", className }) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-20 h-20"
  }

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
    xl: "w-12 h-12"
  }

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          "rounded-full object-cover border-2 border-gray-200 dark:border-gray-700",
          sizeClasses[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600",
        sizeClasses[size],
        className
      )}
    >
      <User className={cn("text-gray-600 dark:text-gray-300", iconSizes[size])} />
    </div>
  )
}

export default Avatar

