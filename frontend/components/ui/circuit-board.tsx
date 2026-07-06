"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface CircuitNode {
  id: string
  x: number
  y: number
  label?: string
  icon?: React.ReactNode
  status?: "active" | "inactive" | "processing" | "error"
  size?: "sm" | "md" | "lg"
}

interface CircuitConnection {
  from: string
  to: string
  animated?: boolean
  bidirectional?: boolean
  color?: string
  pulseColor?: string
  delay?: number
  duration?: number
  pulseLength?: number
  gapLength?: number
  path?: string
}

interface CircuitBoardProps extends React.HTMLAttributes<HTMLDivElement> {
  nodes: CircuitNode[]
  connections: CircuitConnection[]
  width?: number | string
  height?: number | string
  coordWidth?: number
  coordHeight?: number
  gridSize?: number
  showGrid?: boolean
  gridColor?: string
  traceColor?: string
  pulseColor?: string
  nodeColor?: string
  pulseSpeed?: number
  traceWidth?: number
  /** Force a specific theme variant. Defaults to auto-detect from system. */
  variant?: "light" | "dark" | "auto"
  /** Enable futuristic neobrutalist design with thick black borders, offset shadows, and high contrast. */
  neoBrutal?: boolean
}

function CircuitBoard({
  nodes,
  connections,
  width = "100%",
  height = "100%",
  coordWidth,
  coordHeight,
  gridSize = 20,
  showGrid = true,
  gridColor,
  traceColor,
  pulseColor,
  nodeColor,
  pulseSpeed = 2,
  traceWidth = 2,
  variant = "auto",
  neoBrutal = false,
  className,
  ...props
}: CircuitBoardProps) {
  // Theme-aware color defaults
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    if (variant !== "auto") {
      setIsDark(variant === "dark")
      return
    }

    // Check for dark class on html/body
    const checkTheme = () => {
      const isDarkMode = document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark")
      setIsDark(isDarkMode)
    }

    checkTheme()

    // Listen for changes
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    mediaQuery.addEventListener("change", checkTheme)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener("change", checkTheme)
    }
  }, [variant])

  // Compute theme-aware colors
  const computedGridColor = gridColor || (neoBrutal ? "rgba(0, 0, 0, 0.15)" : isDark ? "rgba(163, 163, 163, 0.08)" : "rgba(64, 64, 64, 0.12)")
  const computedTraceColor = traceColor || (neoBrutal ? "#000000" : isDark ? "rgba(163, 163, 163, 0.25)" : "rgba(64, 64, 64, 0.35)")
  const computedPulseColor = pulseColor || (neoBrutal ? "#C084FC" : isDark ? "rgba(163, 163, 163, 0.6)" : "rgba(64, 64, 64, 0.7)")
  const computedNodeColor = nodeColor || (neoBrutal ? "#000000" : isDark ? "rgba(163, 163, 163, 0.5)" : "rgba(64, 64, 64, 0.6)")
  
  const cWidth = coordWidth || (typeof width === "number" ? width : 400)
  const cHeight = coordHeight || (typeof height === "number" ? height : 220)

  const nodeMap = React.useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]))
  }, [nodes])

  const getNodeSize = React.useCallback((size?: CircuitNode["size"]) => {
    switch (size) {
      case "sm":
        return 20
      case "lg":
        return 40
      default:
        return 28
    }
  }, [])

  const calculatePath = React.useCallback(
    (from: CircuitNode, to: CircuitNode): string => {
      const dx = to.x - from.x
      const dy = to.y - from.y

      const startX = from.x
      const startY = from.y
      const endX = to.x
      const endY = to.y

      // Create circuit-like paths with right angles
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal first, then vertical
        const midX = from.x + dx / 2
        return `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`
      } else {
        // Vertical first, then horizontal
        const midY = from.y + dy / 2
        return `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`
      }
    },
    []
  )

  const getStatusColor = (status?: CircuitNode["status"]) => {
    switch (status) {
      case "active":
        return neoBrutal ? "#86EFAC" : isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(64, 64, 64, 0.85)"
      case "processing":
        return neoBrutal ? "#38BDF8" : isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(64, 64, 64, 0.9)"
      case "error":
        return "#FF6B6B" // Red for error
      default:
        return computedNodeColor
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden w-full h-full",
        className
      )}
      style={{ width, height }}
      {...props}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${cWidth} ${cHeight}`}
        preserveAspectRatio="none"
        className="absolute inset-0"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Glow filter for the pulse effect */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Grid pattern */}
          {showGrid && (
            <pattern
              id="circuitGrid"
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
            >
              <circle cx={gridSize / 2} cy={gridSize / 2} r="0.5" fill={computedGridColor} />
            </pattern>
          )}

          {/* Animated gradient for electricity effect */}
          {connections.map((conn, i) => (
            <linearGradient
              key={`gradient-${i}`}
              id={`electricGradient-${i}`}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="transparent" />
              <stop offset="40%" stopColor="transparent" />
              <stop offset="50%" stopColor={conn.pulseColor || computedPulseColor} />
              <stop offset="60%" stopColor="transparent" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid background */}
        {showGrid && (
          <rect width="100%" height="100%" fill="url(#circuitGrid)" />
        )}

        {/* Connection traces */}
        {connections.map((conn, i) => {
          const fromNode = nodeMap.get(conn.from)
          const toNode = nodeMap.get(conn.to)
          if (!fromNode || !toNode) return null

          const path = conn.path || calculatePath(fromNode, toNode)
          const dx = Math.abs(toNode.x - fromNode.x)
          const dy = Math.abs(toNode.y - fromNode.y)
          const actualPathLength = dx + dy
          const pulseLength = conn.pulseLength || Math.max(15, actualPathLength * 0.25)
          const gapLength = conn.gapLength !== undefined ? conn.gapLength : actualPathLength

          return (
            <g key={`connection-${i}`}>
              {/* Base trace */}
              <motion.path
                d={path}
                fill="none"
                stroke={conn.color || computedTraceColor}
                strokeWidth={neoBrutal ? traceWidth + 1.5 : traceWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: i * 0.2 }}
              />

              {/* Animated electricity pulse */}
              {conn.animated !== false && (
                <motion.path
                  d={path}
                  fill="none"
                  stroke={conn.pulseColor || computedPulseColor}
                  strokeWidth={neoBrutal ? traceWidth + 0.5 : traceWidth + 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                  strokeDasharray={`${pulseLength} ${gapLength}`}
                  initial={{ strokeDashoffset: gapLength + pulseLength }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{
                    duration: conn.duration !== undefined ? conn.duration : pulseSpeed,
                    repeat: Infinity,
                    ease: "linear",
                    delay: conn.delay !== undefined ? conn.delay : i * 0.3,
                  }}
                />
              )}

              {/* Bidirectional pulse */}
              {conn.bidirectional && (
                <motion.path
                  d={path}
                  fill="none"
                  stroke={conn.pulseColor || computedPulseColor}
                  strokeWidth={neoBrutal ? traceWidth + 0.5 : traceWidth + 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                  strokeDasharray={`${pulseLength} ${gapLength}`}
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: gapLength + pulseLength }}
                  transition={{
                    duration: conn.duration !== undefined ? conn.duration : pulseSpeed,
                    repeat: Infinity,
                    ease: "linear",
                    delay: conn.delay !== undefined ? conn.delay + (conn.duration !== undefined ? conn.duration : pulseSpeed) / 2 : i * 0.3 + pulseSpeed / 2,
                  }}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Nodes */}
      {nodes.map((node, i) => {
        const size = getNodeSize(node.size)
        const statusColor = getStatusColor(node.status)

        return (
          <motion.div
            key={node.id}
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              left: `${(node.x / cWidth) * 100}%`,
              top: `${(node.y / cHeight) * 100}%`,
              width: size,
              height: size,
              x: "-50%",
              y: "-50%",
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1 + 0.5, type: "spring" }}
          >
            {/* Node background with pulse (only when NOT in neoBrutal mode) */}
            {!neoBrutal && (
              <motion.div
                className="absolute inset-0 rounded-lg"
                style={{ backgroundColor: statusColor }}
                animate={
                  node.status === "processing"
                    ? { opacity: [0.15, 0.45, 0.15] }
                    : { opacity: 0.15 }
              }
              transition={
                node.status === "processing"
                  ? { duration: 1.5, repeat: Infinity }
                  : {}
              }
            />
            )}

            {/* Node border and solid background */}
            <div
              className={cn(
                "absolute inset-0 transition-colors duration-300",
                neoBrutal 
                  ? "border-3 border-black rounded-xl shadow-[3px_3px_0px_#000]"
                  : "border-2 rounded-lg",
                neoBrutal && isDark ? "bg-[#38BDF8]" : ""
              )}
              style={{ 
                borderColor: neoBrutal ? "#000000" : statusColor,
                backgroundColor: neoBrutal
                  ? node.status === "processing"
                    ? "#FFDE4D" // Neon yellow for processing
                    : node.status === "active"
                    ? "#86EFAC" // Neon green for active
                    : node.status === "error"
                    ? "#FF6B6B" // Neon red for error
                    : "#FFFFFF"
                  : isDark ? "#38BDF8" : "#FFFFFF"
              }}
            />

            {/* Inner glow for active nodes */}
            {node.status === "active" && !neoBrutal && (
              <motion.div
                className="absolute inset-0 rounded-lg"
                style={{
                  boxShadow: `0 0 15px ${statusColor}40, inset 0 0 8px ${statusColor}20`,
                }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}

            {/* Node content */}
            <div className="relative z-10 flex flex-col items-center justify-center">
              {node.icon && (
                <div style={{ color: neoBrutal ? "#000000" : statusColor }}>{node.icon}</div>
              )}
            </div>

            {/* Label */}
            {node.label && (
              <div
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black font-mono tracking-wider uppercase"
                style={{ color: neoBrutal ? "#000000" : statusColor }}
              >
                {node.label}
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

// Pre-built circuit patterns
interface CircuitPatternProps extends Omit<CircuitBoardProps, "nodes" | "connections"> {
  pattern: "data-flow" | "network" | "processor" | "tree"
}

function CircuitPattern({ pattern, ...props }: CircuitPatternProps) {
  const patterns = {
    "data-flow": {
      nodes: [
        { id: "input", x: 10, y: 50, label: "Input", status: "active" as const },
        { id: "process1", x: 35, y: 25, label: "Process", status: "processing" as const },
        { id: "process2", x: 35, y: 75, label: "Validate", status: "active" as const },
        { id: "merge", x: 70, y: 50, label: "Merge", status: "active" as const },
        { id: "output", x: 90, y: 50, label: "Output", status: "active" as const },
      ],
      connections: [
        { from: "input", to: "process1", animated: true },
        { from: "input", to: "process2", animated: true },
        { from: "process1", to: "merge", animated: true },
        { from: "process2", to: "merge", animated: true },
        { from: "merge", to: "output", animated: true },
      ],
    },
    network: {
      nodes: [
        { id: "server", x: 50, y: 20, label: "Server", status: "active" as const, size: "lg" as const },
        { id: "client1", x: 15, y: 50, label: "Client 1", status: "active" as const },
        { id: "client2", x: 50, y: 65, label: "Client 2", status: "processing" as const },
        { id: "client3", x: 85, y: 50, label: "Client 3", status: "active" as const },
        { id: "db", x: 50, y: 90, label: "Database", status: "active" as const },
      ],
      connections: [
        { from: "server", to: "client1", bidirectional: true },
        { from: "server", to: "client2", bidirectional: true },
        { from: "server", to: "client3", bidirectional: true },
        { from: "server", to: "db", bidirectional: true },
      ],
    },
    processor: {
      nodes: [
        { id: "alu", x: 50, y: 50, label: "ALU", status: "processing" as const, size: "lg" as const },
        { id: "reg1", x: 25, y: 25, label: "R1", status: "active" as const, size: "sm" as const },
        { id: "reg2", x: 25, y: 50, label: "R2", status: "active" as const, size: "sm" as const },
        { id: "reg3", x: 25, y: 75, label: "R3", status: "active" as const, size: "sm" as const },
        { id: "cache", x: 75, y: 50, label: "Cache", status: "active" as const },
        { id: "out", x: 90, y: 50, label: "Out", status: "active" as const, size: "sm" as const },
      ],
      connections: [
        { from: "reg1", to: "alu", animated: true },
        { from: "reg2", to: "alu", animated: true },
        { from: "reg3", to: "alu", animated: true },
        { from: "alu", to: "cache", animated: true },
        { from: "cache", to: "out", animated: true },
      ],
    },
    tree: {
      nodes: [
        { id: "root", x: 50, y: 15, label: "Root", status: "active" as const },
        { id: "l1", x: 25, y: 40, label: "L1", status: "active" as const },
        { id: "r1", x: 75, y: 40, label: "R1", status: "processing" as const },
        { id: "l1l", x: 15, y: 75, label: "L1L", status: "active" as const, size: "sm" as const },
        { id: "l1r", x: 35, y: 75, label: "L1R", status: "active" as const, size: "sm" as const },
        { id: "r1l", x: 65, y: 75, label: "R1L", status: "error" as const, size: "sm" as const },
        { id: "r1r", x: 85, y: 75, label: "R1R", status: "active" as const, size: "sm" as const },
      ],
      connections: [
        { from: "root", to: "l1", animated: true },
        { from: "root", to: "r1", animated: true },
        { from: "l1", to: "l1l", animated: true },
        { from: "l1", to: "l1r", animated: true },
        { from: "r1", to: "r1l", animated: true },
        { from: "r1", to: "r1r", animated: true },
      ],
    },
  }

  const selectedPattern = patterns[pattern]
  return <CircuitBoard nodes={selectedPattern.nodes} connections={selectedPattern.connections} {...props} />
}

// Interactive circuit node for building custom circuits
interface CircuitNodeComponentProps {
  status?: "active" | "inactive" | "processing" | "error"
  size?: "sm" | "md" | "lg"
  glowColor?: string
  children?: React.ReactNode
  className?: string
  onClick?: () => void
}

function CircuitNode({
  status = "inactive",
  size = "md",
  glowColor,
  children,
  className,
  onClick,
}: CircuitNodeComponentProps) {
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    const checkTheme = () => {
      const isDarkMode = document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark")
      setIsDark(isDarkMode)
    }

    checkTheme()

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    mediaQuery.addEventListener("change", checkTheme)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener("change", checkTheme)
    }
  }, [])

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  }

  const statusColors = isDark
    ? {
      active: "rgba(163, 163, 163, 0.7)",
      inactive: "rgba(115, 115, 115, 0.4)",
      processing: "rgba(163, 163, 163, 0.5)",
      error: "rgba(120, 113, 108, 0.6)",
    }
    : {
      active: "rgba(64, 64, 64, 0.8)",
      inactive: "rgba(100, 100, 100, 0.5)",
      processing: "rgba(64, 64, 64, 0.6)",
      error: "rgba(180, 83, 83, 0.7)",
    }

  const color = glowColor || statusColors[status]

  return (
    <motion.div
      className={cn(
        "relative flex items-center justify-center rounded-lg border",
        isDark ? "bg-neutral-900/50" : "bg-neutral-200/60",
        sizeClasses[size],
        className
      )}
      style={{ borderColor: color }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      {/* Pulse animation for processing state */}
      {status === "processing" && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{ backgroundColor: color }}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Active glow */}
      {status === "active" && (
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            boxShadow: `0 0 20px ${color}60, 0 0 40px ${color}30`,
          }}
        />
      )}

      {/* Error pulse */}
      {status === "error" && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{ boxShadow: `0 0 20px ${color}80` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}

      <div className="relative z-10" style={{ color }}>
        {children}
      </div>
    </motion.div>
  )
}

// Animated trace line component for custom layouts
interface CircuitTraceProps {
  path: string
  animated?: boolean
  color?: string
  pulseColor?: string
  width?: number
  pulseSpeed?: number
}

function CircuitTrace({
  path,
  animated = true,
  color,
  pulseColor,
  width = 2,
  pulseSpeed = 2,
}: CircuitTraceProps) {
  const [isDark, setIsDark] = React.useState(true)

  React.useEffect(() => {
    const checkTheme = () => {
      const isDarkMode = document.documentElement.classList.contains("dark") ||
        document.body.classList.contains("dark")
      setIsDark(isDarkMode)
    }

    checkTheme()

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] })

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    mediaQuery.addEventListener("change", checkTheme)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener("change", checkTheme)
    }
  }, [])

  const computedColor = color || (isDark ? "rgba(163, 163, 163, 0.25)" : "rgba(64, 64, 64, 0.35)")
  const computedPulseColor = pulseColor || (isDark ? "rgba(163, 163, 163, 0.6)" : "rgba(64, 64, 64, 0.7)")
  const pathLength = 500

  return (
    <svg className="absolute inset-0 overflow-visible pointer-events-none">
      <defs>
        <filter id="traceGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Base trace */}
      <motion.path
        d={path}
        fill="none"
        stroke={computedColor}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
      />

      {/* Animated pulse */}
      {animated && (
        <motion.path
          d={path}
          fill="none"
          stroke={computedPulseColor}
          strokeWidth={width + 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#traceGlow)"
          strokeDasharray={`${pathLength * 0.1} ${pathLength * 0.9}`}
          initial={{ strokeDashoffset: pathLength }}
          animate={{ strokeDashoffset: -pathLength }}
          transition={{
            duration: pulseSpeed,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}
    </svg>
  )
}

export {
  CircuitBoard,
  CircuitPattern,
  CircuitNode,
  CircuitTrace,
  type CircuitNode as CircuitNodeType,
  type CircuitConnection,
  type CircuitBoardProps,
}
