import ModelList from "./sidebar/ModelList"
import QueryHistoryList from "./sidebar/QueryHistoryList"

const Sidebar = ({ onQuerySelect, selectedModels, setSelectedModels }) => {
  return (
    <div className="sidebar-main-container">
      {/* Main Content Area - Scrollable */}
      <div className="sidebar-content-area">
        {/* Select AI Models Section */}
        <ModelList selectedModels={selectedModels} setSelectedModels={setSelectedModels} />

        {/* Query History Section */}
        <div className="sidebar-divider">
          <QueryHistoryList onQuerySelect={onQuerySelect} />
        </div>
      </div>
    </div>
  )
}

export default Sidebar
