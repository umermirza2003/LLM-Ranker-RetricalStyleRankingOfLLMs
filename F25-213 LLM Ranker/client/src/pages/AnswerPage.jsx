import { useParams, useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { mockAnswers, defaultAnswer } from "../data/mockAnswers"
import { Card, CardContent } from "../components/ui/card"
import Avatar from "../components/ui/Avatar"

const AnswerPage = () => {
  const { model } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  // Get answer from location state or mock data
  const answerData = location.state?.answer 
    ? { title: "Response", content: location.state.answer }
    : mockAnswers[model?.toLowerCase()] || defaultAnswer

  const handleBack = () => {
    navigate("/")
  }

  // Parse content with markdown-like formatting
  const formatContent = (text) => {
    const lines = text.split('\n')
    const formatted = []
    
    lines.forEach((line, index) => {
      if (line.trim() === '') {
        formatted.push(<br key={index} />)
      } else if (line.match(/^\d+\.\s+\*\*/)) {
        // Numbered bold items
        const match = line.match(/^(\d+\.)\s+\*\*(.+?)\*\*:?\s*(.*)/)
        if (match) {
          formatted.push(
            <div key={index} className="mb-4 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800">
              <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">{match[1]} {match[2]}</span>
              {match[3] && <span className="text-gray-700 dark:text-gray-300 block mt-1">: {match[3]}</span>}
            </div>
          )
        }
      } else if (line.startsWith('-') && line.includes('**')) {
        // Bullet points with bold
        const parts = line.replace(/^-\s+/, '').split('**')
          formatted.push(
            <div key={index} className="mb-3 ml-6 text-gray-700 dark:text-gray-300 flex items-start">
              <span className="text-indigo-500 dark:text-indigo-400 mr-2 mt-1">•</span>
              <span>
                {parts.map((part, i) => 
                  i % 2 === 1 ? <strong key={i} className="text-gray-900 dark:text-gray-100">{part}</strong> : part
                )}
              </span>
            </div>
          )
      } else if (line.startsWith('-')) {
        // Regular bullet points
          formatted.push(
            <div key={index} className="mb-3 ml-6 text-gray-700 dark:text-gray-300 flex items-start">
              <span className="text-indigo-500 dark:text-indigo-400 mr-2 mt-1">•</span>
              <span>{line.replace(/^-\s+/, '')}</span>
            </div>
          )
      } else if (line.startsWith('**') && line.endsWith('**')) {
        // Bold text
          formatted.push(
            <p key={index} className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-lg">
              {line.replace(/\*\*/g, '')}
            </p>
          )
      } else {
        // Regular paragraph
          formatted.push(
            <p key={index} className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed text-base">
              {line}
            </p>
          )
      }
    })
    
    return formatted
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="header-container-fixed">
        <h1 className="header-title-large dark:text-gray-100">LLM RANKER</h1>
        <button className="icon-button dark:hover:bg-gray-700">
          <Avatar src={user?.avatar} alt={user?.name || "User"} size="md" />
        </button>
      </div>

      {/* Main Content */}
      <div className="answer-content-container">
        <div className="answer-content-wrapper">
          <Card className="answer-card">
            <CardContent className="p-8">
              {/* Scrollable Content Area */}
              <div className="answer-scrollable-area">
                {/* Back Button and Title Row */}
                <div className="answer-header-row">
                  <button
                    onClick={handleBack}
                    className="back-button group"
                  >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  </button>
                  <div className="title-row">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{answerData.title}</h2>
                  </div>
                  <div className="spacer"></div>
                </div>

                {/* Divider */}
                <div className="content-divider"></div>

                {/* Content */}
                <div className="answer-content-text mt-6">
                  {formatContent(answerData.content)}
                </div>

                {/* Scroll Down Indicator */}
                <div className="scroll-indicator-container">
                  <ChevronDown className="w-6 h-6 text-gray-400 dark:text-gray-500 animate-bounce" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default AnswerPage

