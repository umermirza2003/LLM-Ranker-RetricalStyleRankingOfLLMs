import { cn } from "@/lib/utils"

const ModelItem = ({ model, isSelected, onToggle }) => {
  return (
    <div
      onClick={() => onToggle(model.id)}
      className={cn(
        "model-item-base",
        isSelected
          ? "model-item-selected"
          : "model-item-unselected"
      )}
    >
      <span className={cn(
        "text-sm",
        isSelected ? "font-semibold" : "font-medium"
      )}>{model.name}</span>
    </div>
  )
}

export default ModelItem

