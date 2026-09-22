import { cn } from "@/lib/utils"

const ChatItem = ({ chat, isActive, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "chat-item-base",
        isActive && "bg-gray-200 dark:bg-slate-700 border-l-4 border-indigo-500 dark:border-indigo-400 font-semibold"
      )}
    >
      <span className={cn(
        "text-sm",
        isActive ? "font-semibold text-gray-900 dark:text-white" : "font-medium"
      )}>{chat.name}</span>
    </div>
  )
}

export default ChatItem

