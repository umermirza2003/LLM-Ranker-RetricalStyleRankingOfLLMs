import { Search, Loader2 } from "lucide-react"
import { Input } from "./ui/input"
import { cn } from "@/lib/utils"

const SearchBar = ({ value, onChange, onSubmit, isLoading = false }) => {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && value.trim() && !isLoading) {
      e.preventDefault()
      onSubmit?.()
    }
  }

  return (
    <div className="search-bar-container">
      {isLoading ? (
        <Loader2 className="search-icon animate-spin" />
      ) : (
        <Search className="search-icon" />
      )}
      <Input
        type="text"
        placeholder="Type your query here and press Enter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className={cn(
          "pl-10 pr-4 py-3 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:border-gray-500 dark:focus:border-gray-500 focus:ring-gray-500 transition-all",
          isLoading && "opacity-75 cursor-wait",
          value.trim() && !isLoading && "ring-2 ring-blue-500/20 dark:ring-blue-400/20"
        )}
      />
    </div>
  )
}

export default SearchBar

