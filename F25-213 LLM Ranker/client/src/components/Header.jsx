import { useAuth } from "../contexts/AuthContext"
import Avatar from "./ui/Avatar"

const Header = () => {
  const { user } = useAuth()
  
  return (
    <div className="header-container">
      <h1 className="header-title-large">LLM RANKER</h1>
      <button className="icon-button">
        <Avatar src={user?.avatar} alt={user?.name || "User"} size="md" />
      </button>
    </div>
  )
}

export default Header

