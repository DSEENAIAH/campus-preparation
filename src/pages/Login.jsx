import React from "react"
import { useNavigate } from "react-router-dom"
import { AppContext } from "../App"
import { useAuth } from "../context/AWSAuthContext"

export default function Login(){
  const nav = useNavigate()
  const { setUser } = React.useContext(AppContext)
  const { unifiedLogin } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    email: "",
    password: ""
  })
  const [errors, setErrors] = React.useState({})

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    
    const result = await unifiedLogin(form.email, form.password)
    setIsLoading(false)
    
    if (result.success) {
      // Role-based redirect
      if (result.role === "admin") {
        nav("/admin/dashboard")
      } else {
        const userName = form.email.split("@")[0]
        setUser({ 
          name: userName.charAt(0).toUpperCase() + userName.slice(1), 
          email: form.email
        })
        nav("/dashboard")
      }
    } else {
      console.error('Login failed:', result.error)
      setErrors({ general: result.error || "Invalid credentials" })
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "white",
      padding: "20px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: "400px",
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "40px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)"
      }}>
        <h1 style={{
          fontSize: "1.8rem",
          fontWeight: "600",
          color: "#0f172a",
          margin: "0 0 8px 0",
          textAlign: "center"
        }}>
          Sign In
        </h1>
        <p style={{
          color: "#64748b",
          fontSize: "0.9rem",
          margin: "0 0 32px 0",
          textAlign: "center"
        }}>
          Enter your credentials to continue
        </p>

        <form onSubmit={handleSubmit}>
          {errors.general && (
            <div style={{
              background: "#fef2f2",
              color: "#dc2626",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "20px",
              border: "1px solid #fecaca",
              fontSize: "0.9rem"
            }}>
              {errors.general}
            </div>
          )}
          


          <div style={{ marginBottom: "20px" }}>
            <label style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: "500",
              color: "#374151",
              fontSize: "0.9rem"
            }}>
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
              placeholder="Enter your email"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "0.9rem",
                outline: "none",
                background: "white",
                boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block",
              marginBottom: "6px",
              fontWeight: "500",
              color: "#374151",
              fontSize: "0.9rem"
            }}>
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})}
              placeholder="Enter your password"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "0.9rem",
                outline: "none",
                background: "white",
                boxSizing: "border-box"
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px",
              background: isLoading ? "#9ca3af" : "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.9rem",
              fontWeight: "500",
              cursor: isLoading ? "not-allowed" : "pointer"
            }}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}