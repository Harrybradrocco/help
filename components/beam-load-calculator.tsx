'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const standardMaterials = {
  'ASTM A36 Structural Steel': {
    yieldStrength: 250,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  'ASTM A992 Structural Steel': {
    yieldStrength: 345,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  'ASTM A572 Grade 50 Steel': {
    yieldStrength: 345,
    elasticModulus: 200,
    density: 7850,
    poissonsRatio: 0.3,
    thermalExpansion: 12,
  },
  'Custom': {
    yieldStrength: 0,
    elasticModulus: 0,
    density: 0,
    poissonsRatio: 0,
    thermalExpansion: 0,
  },
}

export function BeamLoadCalculatorComponent() {
  const [beamType, setBeamType] = useState('Simple Beam')
  const [beamLength, setBeamLength] = useState(1000)
  const [leftSupport, setLeftSupport] = useState(0)
  const [rightSupport, setRightSupport] = useState(1000)
  const [loadType, setLoadType] = useState('Point Load')
  const [loadMagnitude, setLoadMagnitude] = useState(1000)
  const [loadStartPosition, setLoadStartPosition] = useState(500)
  const [loadEndPosition, setLoadEndPosition] = useState(500)
  const [shearForceData, setShearForceData] = useState([])
  const [bendingMomentData, setBendingMomentData] = useState([])
  const [material, setMaterial] = useState('ASTM A36 Structural Steel')
  const [customMaterial, setCustomMaterial] = useState({...standardMaterials['Custom']})
  const [width, setWidth] = useState(100)
  const [height, setHeight] = useState(200)
  const [results, setResults] = useState({
    maxShearForce: 0,
    maxBendingMoment: 0,
    maxNormalStress: 0,
    maxShearStress: 0,
    safetyFactor: 0,
    centerOfGravity: 0,
  })

  const resultsRef = useRef(null)
  const beamDiagramRef = useRef(null)
  const shearForceDiagramRef = useRef(null)
  const bendingMomentDiagramRef = useRef(null)

  const calculateResults = useCallback(() => {
    const newShearForceData = []
    const newBendingMomentData = []
    let maxShearForce = 0
    let maxBendingMoment = 0

    // Convert mm to m for calculations
    const beamLengthM = beamLength / 1000
    const leftSupportM = leftSupport / 1000
    const rightSupportM = rightSupport / 1000
    const loadStartPositionM = loadStartPosition / 1000
    const loadEndPositionM = loadEndPosition / 1000
    const widthM = width / 1000
    const heightM = height / 1000

    // Calculate center of gravity
    const centerOfGravity = beamLengthM / 2

    if (beamType === 'Simple Beam') {
      if (loadType === 'Point Load') {
        const a = loadStartPositionM - leftSupportM
        const b = rightSupportM - loadStartPositionM
        const L = rightSupportM - leftSupportM

        const reactionA = (loadMagnitude * b) / L
        

        for (let x = 0; x <= L; x += L / 100) {
          let shearForce = reactionA
          if (x > a) shearForce -= loadMagnitude

          let bendingMoment = reactionA * x
          if (x > a) bendingMoment -= loadMagnitude * (x - a)

          newShearForceData.push({ x: Number(x.toFixed(3)), shearForce: Number(shearForce.toFixed(2)) })
          newBendingMomentData.push({ x: Number(x.toFixed(3)), bendingMoment: Number(bendingMoment.toFixed(2)) })

          maxShearForce = Math.max(maxShearForce, Math.abs(shearForce))
          maxBendingMoment = Math.max(maxBendingMoment, Math.abs(bendingMoment))
        }
      } else if (loadType === 'Uniform Load') {
        const L = rightSupportM - leftSupportM
        const loadLength = loadEndPositionM - loadStartPositionM
        const w = loadMagnitude / loadLength // Load per unit length

        for (let x = 0; x <= L; x += L / 100) {
          let shearForce = 0
          let bendingMoment = 0

          if (x < loadStartPositionM) {
            shearForce = (w * loadLength * (L - loadStartPositionM - loadLength / 2)) / L
            bendingMoment = shearForce * x
          } else if (x >= loadStartPositionM && x <= loadEndPositionM) {
            shearForce = (w * loadLength * (L - loadStartPositionM - loadLength / 2)) / L - w * (x - loadStartPositionM)
            bendingMoment = (w * loadLength * (L - loadStartPositionM - loadLength / 2) * x) / L - (w * (x - loadStartPositionM) ** 2) / 2
          } else {
            shearForce = -(w * loadLength * (loadStartPositionM + loadLength / 2)) / L
            bendingMoment = (w * loadLength * (loadStartPositionM + loadLength / 2) * (L - x)) / L
          }

          newShearForceData.push({ x: Number(x.toFixed(3)), shearForce: Number(shearForce.toFixed(2)) })
          newBendingMomentData.push({ x: Number(x.toFixed(3)), bendingMoment: Number(bendingMoment.toFixed(2)) })

          maxShearForce = Math.max(maxShearForce, Math.abs(shearForce))
          maxBendingMoment = Math.max(maxBendingMoment, Math.abs(bendingMoment))
        }
      }
    } else if (beamType === 'Cantilever Beam') {
      if (loadType === 'Point Load') {
        for (let x = 0; x <= beamLengthM; x += beamLengthM / 100) {
          const shearForce = x <= loadStartPositionM ? loadMagnitude : 0
          const bendingMoment = x <= loadStartPositionM ? loadMagnitude * (loadStartPositionM - x) : 0

          newShearForceData.push({ x: Number(x.toFixed(3)), shearForce: Number(shearForce.toFixed(2)) })
          newBendingMomentData.push({ x: Number(x.toFixed(3)), bendingMoment: Number(bendingMoment.toFixed(2)) })

          maxShearForce = Math.max(maxShearForce, Math.abs(shearForce))
          maxBendingMoment = Math.max(maxBendingMoment, Math.abs(bendingMoment))
        }
      } else if (loadType === 'Uniform Load') {
        const loadLength = loadEndPositionM - loadStartPositionM
        const w = loadMagnitude / loadLength // Load per unit length

        for (let x = 0; x <= beamLengthM; x += beamLengthM / 100) {
          let shearForce = 0
          let bendingMoment = 0

          if (x <= loadStartPositionM) {
            shearForce = w * loadLength
            bendingMoment = w * loadLength * (loadStartPositionM + loadLength / 2 - x)
          } else if (x > loadStartPositionM && x <= loadEndPositionM) {
            shearForce = w * (loadEndPositionM - x)
            bendingMoment = (w * (loadEndPositionM - x) ** 2) / 2
          }

          newShearForceData.push({ x: Number(x.toFixed(3)), shearForce: Number(shearForce.toFixed(2)) })
          newBendingMomentData.push({ x: Number(x.toFixed(3)), bendingMoment: Number(bendingMoment.toFixed(2)) })

          maxShearForce = Math.max(maxShearForce, Math.abs(shearForce))
          maxBendingMoment = Math.max(maxBendingMoment, Math.abs(bendingMoment))
        }
      }
    }

    setShearForceData(newShearForceData)
    setBendingMomentData(newBendingMomentData)

    const materialProps = material === 'Custom' ? customMaterial : standardMaterials[material]
    const area = widthM * heightM
    const momentOfInertia = (widthM * Math.pow(heightM, 3)) / 12
    const maxNormalStress = (maxBendingMoment * (heightM / 2)) / momentOfInertia
    const maxShearStress = (1.5 * maxShearForce) / area

    setResults({
      maxShearForce: Number(maxShearForce.toFixed(2)),
      maxBendingMoment: Number(maxBendingMoment.toFixed(2)),
      maxNormalStress: Number(maxNormalStress.toFixed(2)),
      maxShearStress: Number(maxShearStress.toFixed(2)),
      safetyFactor: Number((materialProps.yieldStrength / maxNormalStress).toFixed(2)),
      centerOfGravity: Number(centerOfGravity.toFixed(3)),
    })
  }, [beamType, beamLength, leftSupport, rightSupport, loadType, loadMagnitude, loadStartPosition, loadEndPosition, material, customMaterial, width, height])

  useEffect(() => {
    calculateResults()
  }, [calculateResults])

  const BeamDiagram = () => {
    const svgWidth = 500
    const svgHeight = 200
    const margin = 40
    const beamY = svgHeight / 2
    const supportSize = 30

    const leftSupportX = margin + (leftSupport / beamLength) * (svgWidth - 2 * margin)
    const rightSupportX = margin + (rightSupport / beamLength) * (svgWidth - 2 * margin)

    const loadStartX = margin + (loadStartPosition / beamLength) * (svgWidth - 2 * margin)
    const loadEndX = margin + (loadEndPosition / beamLength) * (svgWidth - 2 * margin)

    const centerOfGravityX = margin + (results.centerOfGravity * 1000 / beamLength) * (svgWidth - 2 * margin)

    return (
      <svg width={svgWidth} height={svgHeight} className="mx-auto">
        {/* Beam */}
        <line
          x1={margin}
          y1={beamY}
          x2={svgWidth - margin}
          y2={beamY}
          stroke="black"
          strokeWidth="4"
        />

        {/* Left Support */}
        <polygon
          points={`${leftSupportX},${beamY} ${leftSupportX - supportSize / 2},${
            beamY + supportSize
          } ${leftSupportX + supportSize / 2},${beamY + supportSize}`}
          fill="none"
          stroke="black"
          strokeWidth="2"
        />

        {/* Right Support */}
        <polygon
          points={`${rightSupportX},${beamY} ${rightSupportX - supportSize / 2},${
            beamY + supportSize
          } ${rightSupportX + supportSize / 2},${beamY + supportSize}`}
          fill="none"
          stroke="black"
          strokeWidth="2"
        />

        {/* Load Arrow(s) */}
        {loadType === 'Point Load' ? (
          <line
            x1={loadStartX}
            y1={beamY - 60}
            x2={loadStartX}
            y2={beamY}
            stroke="red"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
        ) : (
          <>
            <line
              x1={loadStartX}
              y1={beamY - 40}
              x2={loadEndX}
              y2={beamY - 40}
              stroke="red"
              strokeWidth="2"
            />
            {Array.from({ length: 5 }).map((_, index) => {
              const x = loadStartX + ((loadEndX - loadStartX) / 4) * index
              return (
                <line
                  key={index}
                  x1={x}
                  y1={beamY - 40}
                  x2={x}
                  y2={beamY}
                  stroke="red"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
              )
            })}
          </>
        )}

        {/* Center of Gravity */}
        <line
          x1={centerOfGravityX}
          y1={beamY - 15}
          x2={centerOfGravityX}
          y2={beamY + 15}
          stroke="blue"
          strokeWidth="2"
        />
        <circle
          cx={centerOfGravityX}
          cy={beamY}
          r="4"
          fill="blue"
        />

        {/* Arrow definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="0"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="red" />
          </marker>
        </defs>

        {/* Labels */}
        <text x={margin} y={beamY + supportSize + 20} textAnchor="middle" fontSize="12">
          0
        </text>
        <text x={svgWidth - margin} y={beamY + supportSize + 20} textAnchor="middle" fontSize="12">
          {beamLength}
        </text>
        <text x={(loadStartX + loadEndX) / 2} y={beamY - 70} textAnchor="middle" fontSize="12" fill="red">
          {loadMagnitude.toFixed(2)} N
        </text>
        <text x={svgWidth / 2} y={svgHeight - 10} textAnchor="middle" fontSize="12">
          Beam Length: {beamLength} mm
        </text>
        <text x={centerOfGravityX} y={beamY + 30} textAnchor="middle" fontSize="12" fill="blue">
          CG
        </text>
      </svg>
    )
  }

  const handleDownloadPDF = async () => {
    const pdf = new jsPDF()
    const elements = [resultsRef, beamDiagramRef, shearForceDiagramRef, bendingMomentDiagramRef]

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i].current
      const canvas = await html2canvas(element)
      const imgData = canvas.toDataURL('image/png')

      if (i !== 0) {
        pdf.addPage()
      }

      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    }

    pdf.save('beam_load_analysis.pdf')
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Beam Load Calculator</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Beam Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="beamType">Beam Type</Label>
                <Select value={beamType} onValueChange={setBeamType}>
                  <SelectTrigger id="beamType">
                    <SelectValue placeholder="Select beam type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Simple Beam">Simple Beam</SelectItem>
                    <SelectItem value="Cantilever Beam">Cantilever Beam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="beamLength">Beam Length (mm)</Label>
                <Input
                  id="beamLength"
                  type="number"
                  value={beamLength}
                  onChange={(e) => setBeamLength(Number(e.target.value))}
                />
              </div>
              {beamType === 'Simple Beam' && (
                <>
                  <div>
                    <Label htmlFor="leftSupport">Left Support Position (mm)</Label>
                    <Input
                      id="leftSupport"
                      type="number"
                      value={leftSupport}
                      onChange={(e) => setLeftSupport(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rightSupport">Right Support Position (mm)</Label>
                    <Input
                      id="rightSupport"
                      type="number"
                      value={rightSupport}
                      onChange={(e) => setRightSupport(Number(e.target.value))}
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Load Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Load Type</Label>
                <RadioGroup value={loadType} onValueChange={setLoadType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Point Load" id="pointLoad" />
                    <Label htmlFor="pointLoad">Point Load</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Uniform Load" id="uniformLoad" />
                    <Label htmlFor="uniformLoad">Uniform Load</Label>
                  </div>
                </RadioGroup>
              </div>
              <div>
                <Label htmlFor="loadMagnitude">Load Magnitude (N)</Label>
                <Input
                  id="loadMagnitude"
                  type="number"
                  value={loadMagnitude}
                  onChange={(e) => setLoadMagnitude(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="loadStartPosition">Load Start Position (mm)</Label>
                <Input
                  id="loadStartPosition"
                  type="number"
                  value={loadStartPosition}
                  onChange={(e) => setLoadStartPosition(Number(e.target.value))}
                />
              </div>
              {loadType === 'Uniform Load' && (
                <div>
                  <Label htmlFor="loadEndPosition">Load End Position (mm)</Label>
                  <Input
                    id="loadEndPosition"
                    type="number"
                    value={loadEndPosition}
                    onChange={(e) => setLoadEndPosition(Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Material Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="material">Material</Label>
                <Select value={material} onValueChange={setMaterial}>
                  <SelectTrigger id="material">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(standardMaterials).map((mat) => (
                      <SelectItem key={mat} value={mat}>
                        {mat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {material === 'Custom' && (
                <>
                  <div>
                    <Label htmlFor="yieldStrength">Yield Strength (MPa)</Label>
                    <Input
                      id="yieldStrength"
                      type="number"
                      value={customMaterial.yieldStrength}
                      onChange={(e) =>
                        setCustomMaterial({ ...customMaterial, yieldStrength: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="elasticModulus">Elastic Modulus (GPa)</Label>
                    <Input
                      id="elasticModulus"
                      type="number"
                      value={customMaterial.elasticModulus}
                      onChange={(e) =>
                        setCustomMaterial({ ...customMaterial, elasticModulus: Number(e.target.value) })
                      }
                    />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Beam Dimensions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="width">Width (mm)</Label>
                <Input
                  id="width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="height">Height (mm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={resultsRef} className="space-y-2">
            <p>Max Shear Force: {results.maxShearForce.toFixed(2)} N</p>
            <p>Max Bending Moment: {results.maxBendingMoment.toFixed(2)} N⋅m</p>
            <p>Max Normal Stress: {results.maxNormalStress.toFixed(2)} MPa</p>
            <p>Max Shear Stress: {results.maxShearStress.toFixed(2)} MPa</p>
            <p>Safety Factor: {results.safetyFactor.toFixed(2)}</p>
            <p>Center of Gravity: {results.centerOfGravity.toFixed(3)} m</p>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Beam Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={beamDiagramRef}>
            <BeamDiagram />
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Shear Force Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={shearForceDiagramRef}>
            <ChartContainer config={{ shearForce: { label: 'Shear Force', color: 'hsl(var(--chart-1))' } }} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={shearForceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" label={{ value: 'Position (m)', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Shear Force (N)', angle: -90, position: 'insideLeft' }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="shearForce" stroke="var(--color-shearForce)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Bending Moment Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={bendingMomentDiagramRef}>
            <ChartContainer config={{ bendingMoment: { label: 'Bending Moment', color: 'hsl(var(--chart-2))' } }} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bendingMomentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" label={{ value: 'Position (m)', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Bending Moment (N⋅m)', angle: -90, position: 'insideLeft' }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="bendingMoment" stroke="var(--color-bendingMoment)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4">
        <Button onClick={handleDownloadPDF}>Download PDF Report</Button>
      </div>
    </div>
  )
}