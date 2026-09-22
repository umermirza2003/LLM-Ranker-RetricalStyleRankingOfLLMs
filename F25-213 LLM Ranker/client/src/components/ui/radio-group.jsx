import * as React from "react"
import { cn } from "@/lib/utils"

const RadioGroupContext = React.createContext(null)

const RadioGroup = React.forwardRef(({ className, value, onValueChange, ...props }, ref) => {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div className={cn("grid gap-2", className)} {...props} ref={ref} />
    </RadioGroupContext.Provider>
  )
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef(({ className, value, id, ...props }, ref) => {
  const context = React.useContext(RadioGroupContext)
  
  const handleChange = (e) => {
    if (context?.onValueChange) {
      context.onValueChange(value)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <input
        type="radio"
        id={id}
        value={value}
        checked={context?.value === value}
        onChange={handleChange}
        className={cn(
          "h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer",
          className
        )}
        ref={ref}
        {...props}
      />
    </div>
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }

