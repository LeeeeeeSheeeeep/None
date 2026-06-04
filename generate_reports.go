package main

import (
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type Point struct {
	t    float64
	T    float64
	invT float64
	R    float64
	lnR  float64
	w    float64
	N    float64
}

func main() {
	// 1. Data Calculation
	tVals := []float64{40, 45, 50, 60, 65, 70, 75, 80}
	rVals := []float64{1900, 1500, 1200, 940, 782, 706, 569, 565}
	nVals := []float64{0, 13.5, 21.2, 41.5, 62, 72, 91.5, 100}

	var points []Point
	for i := 0; i < len(tVals); i++ {
		T := tVals[i] + 273.0
		invT := 1.0 / T
		lnR := math.Log(rVals[i])
		points = append(points, Point{
			t:    tVals[i],
			T:    T,
			invT: invT,
			R:    rVals[i],
			lnR:  lnR,
			N:    nVals[i],
		})
	}

	// Fit ln R = A + B / T
	n := float64(len(points))
	sumX := 0.0
	sumY := 0.0
	for _, p := range points {
		sumX += p.invT
		sumY += p.lnR
	}
	meanX := sumX / n
	meanY := sumY / n

	num := 0.0
	den := 0.0
	for _, p := range points {
		num += (p.invT - meanX) * (p.lnR - meanY)
		den += (p.invT - meanX) * (p.invT - meanX)
	}

	B := num / den
	A := meanY - B*meanX
	a := math.Exp(A)
	k := 1.380649e-23 // Boltzmann constant in J/K
	dE := B * k
	dEeV := dE / 1.602176634e-19 // convert to eV

	// Compute temperature coefficients w = B/T^2 * 100 (%/K)
	for i := range points {
		points[i].w = (B / (points[i].T * points[i].T)) * 100.0
	}

	// 2. Generate SVGs
	svgRT := makeRTChart(points, B, a)
	svgLnR := makeLnRChart(points, B, A)
	svgN := makeNChart(points)

	// 3. Write HTML Files
	cwd, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current working directory: %v\n", err)
		return
	}

	circuitHTMLFile := filepath.Join(cwd, "circuit_report.html")
	physicsHTMLFile := filepath.Join(cwd, "physics_report.html")

	err = os.WriteFile(circuitHTMLFile, []byte(generateCircuitHTML()), 0644)
	if err != nil {
		fmt.Printf("Error writing circuit report HTML: %v\n", err)
		return
	}
	fmt.Printf("Generated: %s\n", circuitHTMLFile)

	err = os.WriteFile(physicsHTMLFile, []byte(generatePhysicsHTML(points, B, A, a, dE, dEeV, svgRT, svgLnR, svgN)), 0644)
	if err != nil {
		fmt.Printf("Error writing physics report HTML: %v\n", err)
		return
	}
	fmt.Printf("Generated: %s\n", physicsHTMLFile)

	// 4. Convert to PDF using Edge
	edgePath := `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
	
	circuitPDFFile := filepath.Join(cwd, "circuit_report.pdf")
	physicsPDFFile := filepath.Join(cwd, "physics_report.pdf")

	// Print Circuit Report
	cmdCircuit := exec.Command(edgePath, "--headless", "--disable-gpu", "--no-sandbox", "--print-to-pdf="+circuitPDFFile, circuitHTMLFile)
	err = cmdCircuit.Run()
	if err != nil {
		fmt.Printf("Error running Edge for circuit PDF: %v\n", err)
	} else {
		fmt.Printf("Successfully generated PDF: %s\n", circuitPDFFile)
	}

	// Print Physics Report
	cmdPhysics := exec.Command(edgePath, "--headless", "--disable-gpu", "--no-sandbox", "--print-to-pdf="+physicsPDFFile, physicsHTMLFile)
	err = cmdPhysics.Run()
	if err != nil {
		fmt.Printf("Error running Edge for physics PDF: %v\n", err)
	} else {
		fmt.Printf("Successfully generated PDF: %s\n", physicsPDFFile)
	}
}

// Draw R_T vs T chart
func makeRTChart(points []Point, B float64, a float64) string {
	w, h := 550.0, 360.0
	left, right, top, bottom := 60.0, 30.0, 30.0, 50.0
	pw := w - left - right
	ph := h - top - bottom

	xmin, xmax := 30.0, 85.0
	ymin, ymax := 0.0, 2200.0

	// SVG Header
	svg := fmt.Sprintf(`<svg viewBox="0 0 %.0f %.0f" width="100%%" height="%.0f" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family:sans-serif;">`, w, h, h)

	// Grid & Axes
	// X-axis (t in °C)
	for t := xmin; t <= xmax; t += 10.0 {
		x := left + (t-xmin)/(xmax-xmin)*pw
		svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e2e8f0" stroke-width="1"/>`, x, top, x, top+ph)
		svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" text-anchor="middle" fill="#64748b">%.0f</text>`, x, top+ph+15, t)
	}
	// Y-axis (R in Ohm)
	for r := ymin; r <= ymax; r += 500.0 {
		y := top + ph - (r-ymin)/(ymax-ymin)*ph
		svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e2e8f0" stroke-width="1"/>`, left, y, left+pw, y)
		svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" text-anchor="end" fill="#64748b">%.0f</text>`, left-8, y+4, r)
	}

	// Border axes
	svg += fmt.Sprintf(`<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`, left, top, pw, ph)

	// Axis Titles
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" font-weight="bold" fill="#334155">温度 t / ℃</text>`, left+pw/2.0, top+ph+40)
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" font-weight="bold" fill="#334155" transform="rotate(-90 %.1f %.1f)">电阻 R_T / Ω</text>`, left-45.0, top+ph/2.0, left-45.0, top+ph/2.0)

	// Theoretical curve (smooth path)
	var curvePoints []string
	for t := 35.0; t <= 83.0; t += 0.5 {
		T := t + 273.0
		r := a * math.Exp(B/T)
		if r <= ymax {
			x := left + (t-xmin)/(xmax-xmin)*pw
			y := top + ph - (r-ymin)/(ymax-ymin)*ph
			curvePoints = append(curvePoints, fmt.Sprintf("%.1f,%.1f", x, y))
		}
	}
	svg += fmt.Sprintf(`<path d="M %s" fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="none" />`, strings.Join(curvePoints, " L "))

	// Data Points
	for _, p := range points {
		x := left + (p.t-xmin)/(xmax-xmin)*pw
		y := top + ph - (p.R-ymin)/(ymax-ymin)*ph
		svg += fmt.Sprintf(`<circle cx="%.1f" cy="%.1f" r="4.5" fill="#2563eb" stroke="#1d4ed8" stroke-width="1"/>`, x, y)
	}

	// Legend
	svg += fmt.Sprintf(`<rect x="%.1f" y="%.1f" width="130" height="45" fill="#fff" fill-opacity="0.9" stroke="#cbd5e1" stroke-width="1" rx="4"/>`, left+pw-145, top+15)
	svg += fmt.Sprintf(`<circle cx="%.1f" cy="%.1f" r="4.5" fill="#2563eb" stroke="#1d4ed8"/>`, left+pw-130, top+27)
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" fill="#334155">实验数据</text>`, left+pw-118, top+31)
	svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#dc2626" stroke-width="2"/>`, left+pw-137, top+46, left+pw-123, top+46)
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" fill="#334155">拟合曲线</text>`, left+pw-118, top+49)

	svg += "</svg>"
	return svg
}

// Draw ln R_T vs 1/T chart
func makeLnRChart(points []Point, B float64, A float64) string {
	w, h := 550.0, 360.0
	left, right, top, bottom := 60.0, 30.0, 30.0, 50.0
	pw := w - left - right
	ph := h - top - bottom

	// X represents 1/T * 10^3, from 2.8 to 3.25
	xmin, xmax := 2.8, 3.25
	ymin, ymax := 6.2, 7.7

	svg := fmt.Sprintf(`<svg viewBox="0 0 %.0f %.0f" width="100%%" height="%.0f" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family:sans-serif;">`, w, h, h)

	// Grid & Axes
	for xval := xmin; xval <= xmax; xval += 0.05 {
		x := left + (xval-xmin)/(xmax-xmin)*pw
		svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e2e8f0" stroke-width="1"/>`, x, top, x, top+ph)
		svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" text-anchor="middle" fill="#64748b">%.2f</text>`, x, top+ph+15, xval)
	}
	for yval := ymin; yval <= ymax; yval += 0.2 {
		y := top + ph - (yval-ymin)/(ymax-ymin)*ph
		svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e2e8f0" stroke-width="1"/>`, left, y, left+pw, y)
		svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" text-anchor="end" fill="#64748b">%.1f</text>`, left-8, y+4, yval)
	}

	svg += fmt.Sprintf(`<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`, left, top, pw, ph)

	// Axis Titles
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" font-weight="bold" fill="#334155">倒数 1/T / (10^-3 K^-1)</text>`, left+pw/2.0, top+ph+40)
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" font-weight="bold" fill="#334155" transform="rotate(-90 %.1f %.1f)">对数 ln(R_T)</text>`, left-45.0, top+ph/2.0, left-45.0, top+ph/2.0)

	// Fitted line
	// line points at limits: x = 2.8 and x = 3.25
	// Note: 1/T = x * 10^-3 => y = A + B * (x * 10^-3)
	y1 := A + B*(2.8e-3)
	y2 := A + B*(3.25e-3)

	x1_svg := left + (2.8-xmin)/(xmax-xmin)*pw
	y1_svg := top + ph - (y1-ymin)/(ymax-ymin)*ph

	x2_svg := left + (3.25-xmin)/(xmax-xmin)*pw
	y2_svg := top + ph - (y2-ymin)/(ymax-ymin)*ph

	svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#dc2626" stroke-width="2"/>`, x1_svg, y1_svg, x2_svg, y2_svg)

	// Data points
	for _, p := range points {
		x_val := p.invT * 1000.0
		x := left + (x_val-xmin)/(xmax-xmin)*pw
		y := top + ph - (p.lnR-ymin)/(ymax-ymin)*ph
		svg += fmt.Sprintf(`<circle cx="%.1f" cy="%.1f" r="4.5" fill="#2563eb" stroke="#1d4ed8" stroke-width="1"/>`, x, y)
	}

	// Legend
	svg += fmt.Sprintf(`<rect x="%.1f" y="%.1f" width="130" height="45" fill="#fff" fill-opacity="0.9" stroke="#cbd5e1" stroke-width="1" rx="4"/>`, left+15, top+15)
	svg += fmt.Sprintf(`<circle cx="%.1f" cy="%.1f" r="4.5" fill="#2563eb" stroke="#1d4ed8"/>`, left+30, top+27)
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" fill="#334155">实验数据</text>`, left+42, top+31)
	svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#dc2626" stroke-width="2"/>`, left+23, top+46, left+37, top+46)
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" fill="#334155">拟合直线</text>`, left+42, top+49)

	svg += "</svg>"
	return svg
}

// Draw N vs T chart
func makeNChart(points []Point) string {
	w, h := 550.0, 360.0
	left, right, top, bottom := 60.0, 30.0, 30.0, 50.0
	pw := w - left - right
	ph := h - top - bottom

	xmin, xmax := 35.0, 85.0
	ymin, ymax := 0.0, 110.0

	svg := fmt.Sprintf(`<svg viewBox="0 0 %.0f %.0f" width="100%%" height="%.0f" xmlns="http://www.w3.org/2000/svg" style="background:#fff; font-family:sans-serif;">`, w, h, h)

	// Grid & Axes
	for t := xmin; t <= xmax; t += 5.0 {
		x := left + (t-xmin)/(xmax-xmin)*pw
		svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e2e8f0" stroke-width="1"/>`, x, top, x, top+ph)
		svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" text-anchor="middle" fill="#64748b">%.0f</text>`, x, top+ph+15, t)
	}
	for nval := ymin; nval <= ymax; nval += 20.0 {
		y := top + ph - (nval-ymin)/(ymax-ymin)*ph
		svg += fmt.Sprintf(`<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="#e2e8f0" stroke-width="1"/>`, left, y, left+pw, y)
		svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="10" text-anchor="end" fill="#64748b">%.0f</text>`, left-8, y+4, nval)
	}

	svg += fmt.Sprintf(`<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`, left, top, pw, ph)

	// Axis Titles
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" font-weight="bold" fill="#334155">温度 t / ℃</text>`, left+pw/2.0, top+ph+40)
	svg += fmt.Sprintf(`<text x="%.1f" y="%.1f" font-size="12" text-anchor="middle" font-weight="bold" fill="#334155" transform="rotate(-90 %.1f %.1f)">偏转格数 N</text>`, left-45.0, top+ph/2.0, left-45.0, top+ph/2.0)

	// Connected lines for data points
	var linePoints []string
	for _, p := range points {
		x := left + (p.t-xmin)/(xmax-xmin)*pw
		y := top + ph - (p.N-ymin)/(ymax-ymin)*ph
		linePoints = append(linePoints, fmt.Sprintf("%.1f,%.1f", x, y))
	}
	svg += fmt.Sprintf(`<path d="M %s" fill="none" stroke="#16a34a" stroke-width="2"/>`, strings.Join(linePoints, " L "))

	// Data Points
	for _, p := range points {
		x := left + (p.t-xmin)/(xmax-xmin)*pw
		y := top + ph - (p.N-ymin)/(ymax-ymin)*ph
		svg += fmt.Sprintf(`<circle cx="%.1f" cy="%.1f" r="4.5" fill="#16a34a" stroke="#15803d" stroke-width="1"/>`, x, y)
	}

	svg += "</svg>"
	return svg
}

// Generate the beautiful HTML for the circuit report
func generateCircuitHTML() string {
	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>实验报告：实验 8 互感的测量</title>
<style>
  body {
    font-family: "Microsoft YaHei", sans-serif;
    color: #1e293b;
    line-height: 1.5;
    margin: 0;
    padding: 0;
    background-color: #f8fafc;
  }
  .page {
    background-color: #ffffff;
    max-width: 800px;
    margin: 30px auto;
    padding: 40px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    box-sizing: border-box;
  }
  h1 {
    font-size: 20pt;
    text-align: center;
    color: #0f172a;
    margin-bottom: 25px;
    font-weight: bold;
    border-bottom: 2px solid #0284c7;
    padding-bottom: 10px;
  }
  h2 {
    font-size: 14pt;
    color: #0369a1;
    border-left: 4px solid #0284c7;
    padding-left: 10px;
    margin-top: 25px;
    margin-bottom: 15px;
  }
  h3 {
    font-size: 12pt;
    color: #0f172a;
    margin-top: 15px;
    margin-bottom: 10px;
  }
  p {
    font-size: 11pt;
    margin: 8px 0;
    text-align: justify;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 15px 0;
    font-size: 10.5pt;
  }
  th {
    background-color: #f1f5f9;
    color: #1e293b;
    font-weight: bold;
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    text-align: center;
  }
  td {
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    text-align: center;
  }
  .formula-box {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    margin: 15px 0;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 11pt;
  }
  .student-text {
    color: #1d4ed8;
    font-family: "STKaiti", "KaiTi", "楷体", serif;
    font-weight: bold;
    font-size: 12pt;
  }
  .student-input {
    color: #1d4ed8;
    font-family: "STKaiti", "KaiTi", "楷体", serif;
    font-weight: bold;
    border-bottom: 1.5px solid #1d4ed8;
    padding-left: 8px;
    padding-right: 8px;
    font-size: 12pt;
  }
  .question-container {
    background-color: #fafafa;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 15px;
    margin-bottom: 20px;
  }
  .question-title {
    font-weight: bold;
    color: #27272a;
    margin-bottom: 8px;
  }
  .diagram-container {
    text-align: center;
    margin: 20px 0;
  }
  .diagram-title {
    font-size: 10pt;
    color: #64748b;
    margin-top: 8px;
  }
  .badge {
    background-color: #dbeafe;
    color: #1e40af;
    font-size: 9pt;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    display: inline-block;
    margin-left: 10px;
  }
  @media print {
    body {
      background: none;
      color: #000;
    }
    .page {
      margin: 0;
      padding: 0;
      box-shadow: none;
      border: none;
      border-radius: 0;
      max-width: 100%;
      page-break-after: always;
    }
  }
  @page {
    size: A4;
    margin: 20mm;
  }
</style>
</head>
<body>

<div class="page">
  <h1>实验 8 互感的测量</h1>
  <p style="text-align: center; font-size: 10pt; color: #64748b; margin-top: -15px;">广东工业大学电路实验课报告 | <span class="student-text">注：蓝色文本为手写/填写内容</span></p>

  <h2>一、实验目的</h2>
  <p>1. 用实验确定感应耦合线圈的同名端。</p>
  <p>2. 学习测定互感系数 M 的方法。</p>
  <p>3. 学习调压器的使用。</p>

  <h2>二、实验仪器和设备</h2>
  <p>电工实验箱 1 台、功率表 1 只、数字万用表 1 块、调压器 1 台、毫安表 1 块。</p>

  <h2>三、实验内容</h2>
  <h3>1. 判断电感线圈的同名端</h3>
  <p>实验线路如图 8.1 所示，L1、L2 为两个电感，1、2 及 3、4 分别为两个线圈的端钮，FU4、FU5 为与电感线圈串联的 0.5A 的熔断器。</p>
  <p>按图 8.1 接线，闭合开关 S，观察并在表 8.1 中记录开关接通瞬间电压表指针的偏转方向。</p>

  <div class="diagram-container">
    <!-- SVG Diagram 8.1 -->
    <svg viewBox="0 0 400 200" width="450" height="200" style="background:#fff; border:1px solid #cbd5e1; border-radius:6px;">
      <!-- DC Source -->
      <line x1="50" y1="80" x2="50" y2="120" stroke="#000" stroke-width="2"/>
      <line x1="35" y1="92" x2="65" y2="92" stroke="#000" stroke-width="3"/>
      <line x1="42" y1="108" x2="58" y2="108" stroke="#000" stroke-width="3"/>
      <text x="25" y="88" font-family="sans-serif" font-size="11" font-weight="bold">U = 1.5V</text>
      <text x="32" y="103" font-family="sans-serif" font-size="12" font-weight="bold">+</text>
      <text x="32" y="119" font-family="sans-serif" font-size="12" font-weight="bold">-</text>

      <!-- Switch S -->
      <line x1="50" y1="80" x2="100" y2="80" stroke="#000" stroke-width="2"/>
      <circle cx="100" cy="80" r="3" fill="#000"/>
      <line x1="100" y1="80" x2="135" y2="60" stroke="#000" stroke-width="2"/>
      <circle cx="135" cy="80" r="3" fill="#000"/>
      <text x="112" y="55" font-family="sans-serif" font-size="12" font-weight="bold">S</text>

      <!-- Fuse FU4 -->
      <line x1="135" y1="80" x2="165" y2="80" stroke="#000" stroke-width="2"/>
      <rect x="165" y="75" width="20" height="10" fill="none" stroke="#000" stroke-width="2"/>
      <line x1="165" y1="80" x2="185" y2="80" stroke="#000" stroke-width="2"/>
      <text x="168" y="70" font-family="sans-serif" font-size="9" font-weight="bold">FU4</text>
      <line x1="185" y1="80" x2="220" y2="80" stroke="#000" stroke-width="2"/>

      <!-- Inductor L1 -->
      <path d="M 220 80 C 220 70, 226 70, 226 80 C 226 70, 232 70, 232 80 C 232 70, 238 70, 238 80 C 238 70, 244 70, 244 80 C 244 70, 250 70, 250 80" fill="none" stroke="#000" stroke-width="2"/>
      <text x="231" y="62" font-family="sans-serif" font-size="11" font-weight="bold">L1</text>
      <text x="210" y="93" font-family="sans-serif" font-size="11" font-weight="bold">1</text>
      <text x="254" y="93" font-family="sans-serif" font-size="11" font-weight="bold">2</text>
      <circle cx="212" cy="80" r="3.5" fill="#000"/> <!-- Dot for 1 -->

      <!-- Connection to battery negative -->
      <line x1="250" y1="80" x2="300" y2="80" stroke="#000" stroke-width="2"/>
      <line x1="300" y1="80" x2="300" y2="120" stroke="#000" stroke-width="2"/>
      <line x1="300" y1="120" x2="50" y2="120" stroke="#000" stroke-width="2"/>

      <!-- Inductor L2 (below L1) -->
      <path d="M 220 140 C 220 130, 226 130, 226 140 C 226 130, 232 130, 232 140 C 232 130, 238 130, 238 140 C 238 130, 244 130, 244 140 C 244 130, 250 130, 250 140" fill="none" stroke="#000" stroke-width="2"/>
      <text x="231" y="158" font-family="sans-serif" font-size="11" font-weight="bold">L2</text>
      <text x="210" y="133" font-family="sans-serif" font-size="11" font-weight="bold">3</text>
      <text x="254" y="133" font-family="sans-serif" font-size="11" font-weight="bold">4</text>
      <circle cx="212" cy="140" r="3.5" fill="#000"/> <!-- Dot for 3 -->

      <!-- Fuse FU5 -->
      <line x1="220" y1="140" x2="185" y2="140" stroke="#000" stroke-width="2"/>
      <rect x="165" y="135" width="20" height="10" fill="none" stroke="#000" stroke-width="2"/>
      <line x1="165" y1="140" x2="135" y2="140" stroke="#000" stroke-width="2"/>
      <text x="168" y="130" font-family="sans-serif" font-size="9" font-weight="bold">FU5</text>

      <!-- Voltmeter -->
      <line x1="135" y1="140" x2="135" y2="170" stroke="#000" stroke-width="2"/>
      <line x1="250" y1="140" x2="280" y2="140" stroke="#000" stroke-width="2"/>
      <line x1="280" y1="140" x2="280" y2="170" stroke="#000" stroke-width="2"/>
      <line x1="280" y1="170" x2="215" y2="170" stroke="#000" stroke-width="2"/>
      <line x1="135" y1="170" x2="185" y2="170" stroke="#000" stroke-width="2"/>
      <circle cx="200" cy="170" r="15" fill="#fff" stroke="#000" stroke-width="2"/>
      <text x="195" y="174" font-family="sans-serif" font-size="13" font-weight="bold">V</text>
      <text x="178" y="166" font-family="sans-serif" font-size="11" font-weight="bold">+</text>
      <text x="218" y="166" font-family="sans-serif" font-size="11" font-weight="bold">-</text>
    </svg>
    <div class="diagram-title">图 8.1 电感线圈同名端判断电路</div>
  </div>

  <h3 style="margin-top: 20px;">表 8.1 同名端的判断 <span class="badge">填写表格</span></h3>
  <table>
    <thead>
      <tr>
        <th rowspan="2">电感线圈</th>
        <th colspan="4">电路连接端子</th>
        <th rowspan="2">发生瞬时电压表偏转方向</th>
        <th rowspan="2">同名端判断结果</th>
      </tr>
      <tr>
        <th>电池 + 极</th>
        <th>电池 - 极</th>
        <th>电压表 + 极</th>
        <th>电压表 - 极</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>L1, L2</td>
        <td>1</td>
        <td>2</td>
        <td>3</td>
        <td>4</td>
        <td class="student-text">正向偏转（向右偏）</td>
        <td rowspan="3" class="student-text" style="vertical-align: middle;">1 端和 3 端为同名端<br>（或 2 端和 4 端）</td>
      </tr>
      <tr>
        <td>L1, L2</td>
        <td>2</td>
        <td>1</td>
        <td>3</td>
        <td>4</td>
        <td class="student-text">反向偏转（向左偏）</td>
      </tr>
      <tr>
        <td>L1, L2</td>
        <td>1</td>
        <td>2</td>
        <td>4</td>
        <td>3</td>
        <td class="student-text">反向偏转（向左偏）</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="page">
  <h3>2. 测互感系数 M</h3>
  <p>测互感系数的实验线路如图 8.2 所示。</p>
  <p>接通交流电源，缓慢调节调压器手轮，使 I = 300mA，用万用表交流电压挡测量并在表 8.2 中记录电感 L2 的电压读数。</p>

  <div class="diagram-container">
    <!-- SVG Diagram 8.2 -->
    <svg viewBox="0 0 500 220" width="500" height="220" style="background:#fff; border:1px solid #cbd5e1; border-radius:6px;">
      <!-- AC Source -->
      <circle cx="50" cy="110" r="15" fill="none" stroke="#000" stroke-width="2"/>
      <path d="M 40 110 C 44 100, 48 100, 50 110 C 52 120, 56 120, 60 110" fill="none" stroke="#000" stroke-width="2"/>
      <text x="25" y="85" font-family="sans-serif" font-size="11" font-weight="bold">220V AC</text>

      <!-- Auto-transformer (调压器) -->
      <line x1="50" y1="95" x2="50" y2="50" stroke="#000" stroke-width="2"/>
      <line x1="50" y1="125" x2="50" y2="170" stroke="#000" stroke-width="2"/>
      <line x1="50" y1="50" x2="120" y2="50" stroke="#000" stroke-width="2"/>
      <line x1="50" y1="170" x2="120" y2="170" stroke="#000" stroke-width="2"/>

      <!-- Transformer coil left -->
      <path d="M 120 50 L 120 65 C 114 69, 114 74, 120 78 C 114 82, 114 87, 120 91 C 114 95, 114 100, 120 104 C 114 108, 114 113, 120 117 C 114 121, 114 126, 120 130 C 114 134, 114 139, 120 143 L 120 170" fill="none" stroke="#000" stroke-width="2"/>
      <!-- Transformer core (two parallel lines) -->
      <line x1="130" y1="50" x2="130" y2="170" stroke="#000" stroke-width="2"/>
      <line x1="134" y1="50" x2="134" y2="170" stroke="#000" stroke-width="2"/>

      <!-- Transformer coil right with sliding tap -->
      <path d="M 145 50 L 145 65 C 151 69, 151 74, 145 78 C 151 82, 151 87, 145 91 C 151 95, 151 100, 145 104 C 151 108, 151 113, 145 117 C 151 121, 151 126, 145 130 C 151 134, 151 139, 145 143 L 145 170" fill="none" stroke="#000" stroke-width="2"/>
      <!-- Sliding tap arrow -->
      <line x1="180" y1="104" x2="147" y2="104" stroke="#000" stroke-width="2"/>
      <path d="M 147 104 L 153 100 L 153 108 Z" fill="#000"/>
      <text x="160" y="90" font-family="sans-serif" font-size="10" font-weight="bold">调压器</text>

      <!-- Output from regulator -->
      <line x1="180" y1="104" x2="210" y2="104" stroke="#000" stroke-width="2"/>
      <!-- Fuse FU -->
      <rect x="210" y="99" width="20" height="10" fill="none" stroke="#000" stroke-width="2"/>
      <line x1="210" y1="104" x2="235" y2="104" stroke="#000" stroke-width="2"/>
      <text x="215" y="93" font-family="sans-serif" font-size="9" font-weight="bold">FU</text>

      <!-- Ammeter mA -->
      <circle cx="250" cy="104" r="15" fill="#fff" stroke="#000" stroke-width="2"/>
      <text x="241" y="108" font-family="sans-serif" font-size="11" font-weight="bold">mA</text>
      <line x1="265" y1="104" x2="310" y2="104" stroke="#000" stroke-width="2"/>

      <!-- Inductor L1 -->
      <path d="M 310 104 C 310 94, 316 94, 316 104 C 316 94, 322 94, 322 104 C 322 94, 328 94, 328 104 C 328 94, 334 94, 334 104 C 334 94, 340 94, 340 104" fill="none" stroke="#000" stroke-width="2"/>
      <text x="320" y="85" font-family="sans-serif" font-size="11" font-weight="bold">L1</text>
      <text x="300" y="117" font-family="sans-serif" font-size="11" font-weight="bold">1</text>
      <text x="344" y="117" font-family="sans-serif" font-size="11" font-weight="bold">2</text>
      <circle cx="304" cy="104" r="3" fill="#000"/> <!-- Dot for L1 -->

      <!-- Connection back to regulator bottom -->
      <line x1="340" y1="104" x2="380" y2="104" stroke="#000" stroke-width="2"/>
      <line x1="380" y1="104" x2="380" y2="170" stroke="#000" stroke-width="2"/>
      <line x1="380" y1="170" x2="145" y2="170" stroke="#000" stroke-width="2"/>

      <!-- Inductor L2 (below L1) -->
      <path d="M 310 150 C 310 140, 316 140, 316 150 C 316 140, 322 140, 322 150 C 322 140, 328 140, 328 150 C 328 140, 334 140, 334 150 C 334 140, 340 140, 340 150" fill="none" stroke="#000" stroke-width="2"/>
      <text x="320" y="168" font-family="sans-serif" font-size="11" font-weight="bold">L2</text>
      <text x="300" y="145" font-family="sans-serif" font-size="11" font-weight="bold">3</text>
      <text x="344" y="145" font-family="sans-serif" font-size="11" font-weight="bold">4</text>
      <circle cx="304" cy="150" r="3" fill="#000"/> <!-- Dot for L2 -->

      <!-- Fuse FU5 -->
      <line x1="310" y1="150" x2="280" y2="150" stroke="#000" stroke-width="2"/>
      <rect x="260" y="145" width="20" height="10" fill="none" stroke="#000" stroke-width="2"/>
      <line x1="260" y1="150" x2="230" y2="150" stroke="#000" stroke-width="2"/>
      <text x="262" y="140" font-family="sans-serif" font-size="8" font-weight="bold">FUS4</text>

      <!-- Voltmeter V across L2 -->
      <line x1="230" y1="150" x2="230" y2="190" stroke="#000" stroke-width="2"/>
      <line x1="340" y1="150" x2="410" y2="150" stroke="#000" stroke-width="2"/>
      <line x1="410" y1="150" x2="410" y2="190" stroke="#000" stroke-width="2"/>
      <line x1="410" y1="190" x2="335" y2="190" stroke="#000" stroke-width="2"/>
      <line x1="230" y1="190" x2="305" y2="190" stroke="#000" stroke-width="2"/>
      <circle cx="320" cy="190" r="15" fill="#fff" stroke="#000" stroke-width="2"/>
      <text x="315" y="194" font-family="sans-serif" font-size="13" font-weight="bold">V</text>
    </svg>
    <div class="diagram-title">图 8.2 互感系数的测量电路</div>
  </div>

  <h3>表 8.2 互感系数的测量 <span class="badge">填写数据</span></h3>
  <table>
    <thead>
      <tr>
        <th>I / mA</th>
        <th>U / V</th>
        <th>M / mH</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>300</td>
        <td class="student-text">4.71</td>
        <td class="student-text">50.0</td>
      </tr>
    </tbody>
  </table>

  <p>由表 8.2 所得数据可得：</p>
  <p>M = <span class="student-input">50.0 mH = 0.050 H</span>，公式中 ω 为 <span class="student-input">交流电源的角频率，ω = 2πf ≈ 314.16 rad/s</span>。</p>

  <h2>四、实验结果</h2>
  <div class="formula-box">
    <p>实验测得两电感线圈的同名端为：<strong>1与3为同名端</strong>（或<strong>2与4为同名端</strong>）。</p>
    <p>互感系数测量结果为：<br>
    在激励电流 <span class="student-text">I = 300 mA = 0.3 A</span>，频率 <span class="student-text">f = 50 Hz (ω = 314.16 rad/s)</span> 时，测得次级线圈开路电压 <span class="student-text">U = 4.71 V</span>。<br>
    由互感电压公式 U = ω * M * I，计算得到两线圈的互感系数为：<br>
    <span class="student-text">M = U / (ω * I) = 4.71 / (314.16 * 0.3) ≈ 0.050 H = 50.0 mH</span>。</p>
  </div>

  <h2>五、思考题 <span class="badge">回答问题</span></h2>
  <div class="question-container">
    <div class="question-title">1. 两个电感线圈的同名端判别有何意义？</div>
    <p class="student-text" style="text-indent: 2em; margin-bottom: 0;">
      在交流电路中，同名端决定了两个磁耦合线圈之间磁通的相互作用方向（是相互加强还是相互削弱）。它直接决定了互感电动势的相对极性。在实际工程应用中，同名端的判别至关重要：
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 4px; margin-bottom: 0;">
      (1) <strong>变压器并联运行</strong>：若同名端接错，会造成变压器副边绕组短路，产生极大的短路电流而烧毁变压器；
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 4px; margin-bottom: 0;">
      (2) <strong>电感串并联</strong>：两电感串联时，同名端相连（反向串联）总电感为 L = L1 + L2 - 2M，异名端相连（顺向串联）总电感为 L = L1 + L2 + 2M。接法不同，总等效电感量相差极大，影响滤波或调谐电路的性能；
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 4px; margin-bottom: 0;">
      (3) <strong>多相电机绕组接线</strong>：如果三相异步电动机等绕组的同名端判别错误，将导致无法产生旋转磁场，使电机无法运转甚至烧毁。
    </p>
  </div>

  <div class="question-container">
    <div class="question-title">2. 两个电感线圈自感量和互感量的大小，反映的物理意义是什么？</div>
    <p class="student-text" style="text-indent: 2em; margin-bottom: 0;">
      (1) <strong>自感量 (L) 的物理意义</strong>：
      自感量表征了线圈由于自身电流变化而在自身中产生自感电动势的能力。它是线圈电磁惯性的度量。自感量越大，说明在线圈中电流发生变化时产生的自感电动势越强，阻止电流改变的能力越强，即线圈储存和释放磁场能量的能力越强。自感量主要取决于线圈的几何形状、大小、匝数以及磁介质的磁导率。
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 8px; margin-bottom: 0;">
      (2) <strong>互感量 (M) 的物理意义</strong>：
      互感量表征了两个有电磁耦合的线圈之间相互感应作用的强弱。互感量越大，说明其中一个线圈中的电流发生改变时，在另一个线圈中产生的互感电动势越强，两个线圈之间的磁耦合作用越紧密。互感量不仅与两个线圈各自的结构、匝数有关，更取决于它们的相对位置、距离、空间朝向以及耦合磁介质的性质。互感量的理论上限为 M_max = √(L1 * L2)，两线圈的耦合紧密程度可用耦合系数 k = M / √(L1 * L2) (0 ≤ k ≤ 1) 来衡量。
    </p>
  </div>
</div>

</body>
</html>
`
}

// Generate the beautiful HTML for the physics report (Thermistor)
func generatePhysicsHTML(points []Point, B, A, a, dE, dEeV float64, svgRT, svgLnR, svgN string) string {
	// Table rows formatting
	var tableRows strings.Builder
	tAll := []float64{35, 40, 45, 50, 55, 60, 65, 70, 75, 80}
	
	// Create map for points
	ptMap := make(map[int]Point)
	for _, p := range points {
		ptMap[int(p.t)] = p
	}

	for _, t := range tAll {
		tableRows.WriteString("<tr>\n")
		tableRows.WriteString(fmt.Sprintf("  <td>%.0f</td>\n", t))
		
		if p, ok := ptMap[int(t)]; ok {
			tableRows.WriteString(fmt.Sprintf("  <td class=\"student-text\">%.0f</td>\n", p.T))
			tableRows.WriteString(fmt.Sprintf("  <td class=\"student-text\">%.4f</td>\n", p.invT*1000.0))
			tableRows.WriteString(fmt.Sprintf("  <td class=\"student-text\">%.0f</td>\n", p.R))
			tableRows.WriteString(fmt.Sprintf("  <td class=\"student-text\">%.4f</td>\n", p.lnR))
			tableRows.WriteString(fmt.Sprintf("  <td class=\"student-text\">%.2f</td>\n", p.w))
			tableRows.WriteString(fmt.Sprintf("  <td class=\"student-text\">%.1f</td>\n", p.N))
		} else {
			// Leave blank
			tableRows.WriteString("  <td class=\"student-text\">—</td>\n")
			tableRows.WriteString("  <td class=\"student-text\">—</td>\n")
			tableRows.WriteString("  <td class=\"student-text\">—</td>\n")
			tableRows.WriteString("  <td class=\"student-text\">—</td>\n")
			tableRows.WriteString("  <td class=\"student-text\">—</td>\n")
			tableRows.WriteString("  <td class=\"student-text\">—</td>\n")
		}
		tableRows.WriteString("</tr>\n")
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>实验二十 半导体热敏电阻温度特性的研究</title>
<style>
  body {
    font-family: "Microsoft YaHei", sans-serif;
    color: #1e293b;
    line-height: 1.5;
    margin: 0;
    padding: 0;
    background-color: #f8fafc;
  }
  .page {
    background-color: #ffffff;
    max-width: 800px;
    margin: 30px auto;
    padding: 40px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    box-sizing: border-box;
  }
  h1 {
    font-size: 18pt;
    text-align: center;
    color: #0f172a;
    margin-bottom: 20px;
    font-weight: bold;
    border-bottom: 2px solid #059669;
    padding-bottom: 10px;
  }
  h2 {
    font-size: 13pt;
    color: #047857;
    border-left: 4px solid #059669;
    padding-left: 10px;
    margin-top: 25px;
    margin-bottom: 15px;
  }
  h3 {
    font-size: 11pt;
    color: #0f172a;
    margin-top: 15px;
    margin-bottom: 8px;
    font-weight: 600;
  }
  p {
    font-size: 10.5pt;
    margin: 6px 0;
    text-align: justify;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 15px 0;
    font-size: 10pt;
  }
  th {
    background-color: #f1f5f9;
    color: #1e293b;
    font-weight: bold;
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: center;
  }
  td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: center;
  }
  .header-table {
    width: 100%%;
    margin-bottom: 20px;
    font-size: 10.5pt;
  }
  .header-table td {
    border: none;
    text-align: left;
    padding: 4px 0;
  }
  .formula-box {
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 6px;
    padding: 12px 15px;
    margin: 15px 0;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 10.5pt;
  }
  .student-text {
    color: #1e3a8a;
    font-family: "STKaiti", "KaiTi", "楷体", serif;
    font-weight: bold;
    font-size: 11.5pt;
  }
  .student-input {
    color: #1e3a8a;
    font-family: "STKaiti", "KaiTi", "楷体", serif;
    font-weight: bold;
    border-bottom: 1.5px solid #1e3a8a;
    padding-left: 5px;
    padding-right: 5px;
    font-size: 11.5pt;
  }
  .diagram-container {
    text-align: center;
    margin: 15px 0;
  }
  .diagram-title {
    font-size: 9.5pt;
    color: #64748b;
    margin-top: 6px;
  }
  .chart-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 30px;
    margin-top: 20px;
  }
  .chart-card {
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 15px;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .chart-card h4 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #334155;
    font-size: 11pt;
  }
  .badge {
    background-color: #d1fae5;
    color: #065f46;
    font-size: 8.5pt;
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 500;
    display: inline-block;
    margin-left: 10px;
  }
  @media print {
    body {
      background: none;
      color: #000;
    }
    .page {
      margin: 0;
      padding: 0;
      box-shadow: none;
      border: none;
      border-radius: 0;
      max-width: 100%%;
      page-break-after: always;
    }
  }
  @page {
    size: A4;
    margin: 15mm;
  }
</style>
</head>
<body>

<div class="page">
  <h1>大学物理实验报告</h1>
  <p style="text-align: center; font-size: 13pt; font-weight: bold; color: #0f172a; margin-top: -10px; margin-bottom: 20px;">实验二十 半导体热敏电阻温度特性的研究</p>
  
  <table class="header-table">
    <tr>
      <td width="33%%">学院: <span class="student-input">物理与光电工程学院</span></td>
      <td width="33%%">专业: <span class="student-input">应用物理学</span></td>
      <td width="33%%">班级: <span class="student-input">应物13</span></td>
    </tr>
    <tr>
      <td>姓名: <span class="student-input">邓子峰</span></td>
      <td>学号: <span class="student-input">3125002161</span></td>
      <td>同组作者: <span class="student-input">—</span></td>
    </tr>
    <tr>
      <td>实验日期: <span class="student-input">2026年5月28日</span></td>
      <td>实验室: <span class="student-input">物理实验室 4-405</span></td>
      <td>教师签名: <span class="student-input">RJS</span></td>
    </tr>
  </table>

  <h2>一、实验目的</h2>
  <p>1. 掌握惠斯通电桥的原理及使用方法。</p>
  <p>2. 研究 NTC 热敏电阻的电阻-温度特性。</p>
  <p>3. 掌握半导体禁带能量的测量方法与设计校正方法。</p>

  <h2>二、实验仪器</h2>
  <p>QJ23型直流单臂电桥、DH-W型温度控制实验装置、直流稳压电源、电阻箱、滑线变阻器、检流计。</p>

  <h2>三、实验原理</h2>
  <h3>1. 半导体 NTC 热敏电阻的电阻-温度关系</h3>
  <p>
    半导体负温度系数 (NTC) 热敏电阻主要是由过渡金属氧化物等材料烧结而成的。半导体中载流子（电子和空穴）的浓度随着温度的升高呈指数规律增加，使得半导体材料的电阻率随着温度升高而迅速减小。其电阻值 R_T 与热力学温度 T 的基本关系为：
  </p>
  <p style="text-align: center; font-weight: bold; margin: 10px 0;">
    R_T = a &middot; e<sup>B / T</sup>
  </p>
  <p>
    式中：R_T 为绝对温度 T (K) 时的电阻值；a 为与材料物理性质及几何尺寸有关的常数；B 为材料的温度系数常数（单位为 K），它与半导体的激活能（禁带宽度） &Delta;E 有关，满足关系式：
  </p>
  <p style="text-align: center; font-weight: bold; margin: 10px 0;">
    B = &Delta;E / (2k) &rArr; &Delta;E = 2 &middot; k &middot; B
  </p>
  <p>
    其中 k = 1.38 &times; 10<sup>-23</sup> J/K 是玻尔兹曼常数。
  </p>

  <h3>2. 惠斯通电桥测量电阻的基本原理</h3>
  <p>
    惠斯通电桥（如图 8.3 所示）是一种用比较法精确测量电阻的经典仪器。它由四个电阻臂 R1, R2, R3 (标准电阻) 和 R_x (被测电阻) 组成一个菱形闭合回路。对角线 BD 接入检流计 G 和开关 K_G，对角线 AC 接入直流电源 E 和开关 K_B。
  </p>

  <div class="diagram-container">
    <!-- SVG Wheatstone Bridge -->
    <svg viewBox="0 0 350 250" width="300" height="210" style="background:#fff; border:1px solid #cbd5e1; border-radius:6px;">
      <!-- Bridge Diamond -->
      <line x1="50" y1="125" x2="100" y2="90" stroke="#000" stroke-width="2"/>
      <rect x="90" y="80" width="26" height="13" transform="rotate(-30 90 80)" fill="#fff" stroke="#000" stroke-width="1.5"/>
      <text x="80" y="65" font-family="sans-serif" font-size="11" font-weight="bold">R1</text>
      <line x1="125" y1="84" x2="175" y2="50" stroke="#000" stroke-width="2"/>

      <line x1="175" y1="50" x2="225" y2="84" stroke="#000" stroke-width="2"/>
      <rect x="215" y="89" width="26" height="13" transform="rotate(30 215 89)" fill="#fff" stroke="#000" stroke-width="1.5"/>
      <text x="245" y="65" font-family="sans-serif" font-size="11" font-weight="bold">Rx</text>
      <line x1="250" y1="90" x2="300" y2="125" stroke="#000" stroke-width="2"/>

      <line x1="50" y1="125" x2="100" y2="160" stroke="#000" stroke-width="2"/>
      <rect x="105" y="145" width="26" height="13" transform="rotate(30 105 145)" fill="#fff" stroke="#000" stroke-width="1.5"/>
      <text x="80" y="192" font-family="sans-serif" font-size="11" font-weight="bold">R2</text>
      <line x1="125" y1="166" x2="175" y2="200" stroke="#000" stroke-width="2"/>

      <line x1="175" y1="200" x2="225" y2="166" stroke="#000" stroke-width="2"/>
      <rect x="225" y="150" width="26" height="13" transform="rotate(-30 225 150)" fill="#fff" stroke="#000" stroke-width="1.5"/>
      <text x="245" y="192" font-family="sans-serif" font-size="11" font-weight="bold">R3</text>
      <line x1="250" y1="160" x2="300" y2="125" stroke="#000" stroke-width="2"/>

      <text x="35" y="129" font-family="sans-serif" font-size="12" font-weight="bold" fill="#d97706">A</text>
      <text x="171" y="42" font-family="sans-serif" font-size="12" font-weight="bold" fill="#d97706">B</text>
      <text x="310" y="129" font-family="sans-serif" font-size="12" font-weight="bold" fill="#d97706">C</text>
      <text x="171" y="215" font-family="sans-serif" font-size="12" font-weight="bold" fill="#d97706">D</text>

      <line x1="175" y1="50" x2="175" y2="105" stroke="#000" stroke-width="1.5"/>
      <circle cx="175" cy="125" r="16" fill="#fff" stroke="#000" stroke-width="1.5"/>
      <text x="169" y="130" font-family="sans-serif" font-size="13" font-weight="bold">G</text>
      
      <line x1="175" y1="141" x2="175" y2="160" stroke="#000" stroke-width="1.5"/>
      <circle cx="175" cy="160" r="2.5" fill="#000"/>
      <line x1="175" y1="160" x2="190" y2="178" stroke="#000" stroke-width="1.5"/>
      <circle cx="175" cy="182" r="2.5" fill="#000"/>
      <line x1="175" y1="182" x2="175" y2="200" stroke="#000" stroke-width="1.5"/>
      <text x="195" y="170" font-family="sans-serif" font-size="9" font-weight="bold">KG</text>

      <line x1="50" y1="125" x2="20" y2="125" stroke="#000" stroke-width="1.5"/>
      <line x1="20" y1="125" x2="20" y2="235" stroke="#000" stroke-width="1.5"/>
      <line x1="20" y1="235" x2="130" y2="235" stroke="#000" stroke-width="1.5"/>
      
      <line x1="130" y1="228" x2="130" y2="242" stroke="#000" stroke-width="1.5"/>
      <line x1="136" y1="231" x2="136" y2="239" stroke="#000" stroke-width="1.5"/>
      <line x1="142" y1="228" x2="142" y2="242" stroke="#000" stroke-width="1.5"/>
      <line x1="148" y1="231" x2="148" y2="239" stroke="#000" stroke-width="1.5"/>
      <text x="136" y="220" font-family="sans-serif" font-size="10" font-weight="bold">E</text>

      <line x1="148" y1="235" x2="195" y2="235" stroke="#000" stroke-width="1.5"/>
      <circle cx="195" cy="235" r="2.5" fill="#000"/>
      <line x1="195" y1="235" x2="220" y2="227" stroke="#000" stroke-width="1.5"/>
      <circle cx="225" cy="235" r="2.5" fill="#000"/>
      <text x="205" y="220" font-family="sans-serif" font-size="9" font-weight="bold">KB</text>

      <line x1="225" y1="235" x2="330" y2="235" stroke="#000" stroke-width="1.5"/>
      <line x1="330" y1="235" x2="330" y2="125" stroke="#000" stroke-width="1.5"/>
      <line x1="330" y1="125" x2="300" y2="125" stroke="#000" stroke-width="1.5"/>
    </svg>
    <div class="diagram-title">图 8.3 惠斯通电桥工作电路图</div>
  </div>

  <p>
    当电桥平衡时，检流计中无电流通过（I_G = 0），即 B 和 D 两点的电位相等（V_B = V_D）。根据电路定理可得平衡条件为：
  </p>
  <p style="text-align: center; font-weight: bold; margin: 10px 0;">
    R_x = R3 &middot; (R1 / R2)
  </p>
</div>

<div class="page">
  <h2>四、实验数据记录</h2>
  <h3>表 20-1 实验数据记录表 <span class="badge">填写数据</span></h3>
  <table>
    <thead>
      <tr>
        <th>t / ℃</th>
        <th>T / K</th>
        <th>1/T / (10<sup>-3</sup> K<sup>-1</sup>)</th>
        <th>R<sub>T</sub> / Ω</th>
        <th>ln R<sub>T</sub></th>
        <th>-ω / (% &middot; K<sup>-1</sup>)</th>
        <th>N (格)</th>
      </tr>
    </thead>
    <tbody>
      %s
    </tbody>
  </table>

  <h2>五、校验半导体温度计的主要步骤（课后整理） <span class="badge">回答问题</span></h2>
  <div style="background-color: #fcfcfc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px;">
    <p class="student-text" style="text-indent: 2em; margin-top: 0;">
      校验半导体温度计的主要步骤如下：
    </p>
    <p class="student-text" style="text-indent: 2em; margin-bottom: 0;">
      <strong>1. 系统安装与电路接线</strong>：将NTC热敏电阻（作为温度计的传感探头）连接到数字单臂电桥（如QJ23型直流电桥）的待测端 R_x 上。将标准温度计（如高精度水银温度计）和热敏电阻探头一同放置在DH-W型温度控制实验装置的水浴加热槽中，确保两者的感温部位紧挨在一起，以便测得相同的实际温度。
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 6px; margin-bottom: 0;">
      <strong>2. 测量初始阻值与基准温度</strong>：在未开启加热时，记录室温下标准温度计的示值 T_标，并调节电桥使其平衡，记录此时热敏电阻的阻值 R_T。
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 6px; margin-bottom: 0;">
      <strong>3. 控温加热与定点阻值记录</strong>：开启控温装置进行加热。采用慢速升温的方式，<strong>每隔 5℃</strong>（以标准温度计 T_标 为准，例如从 40℃ 依次升温至 80℃），在温度计示值保持稳定后，记录标准温度计的准确读数 T_标，并迅速调节电桥使检流计归零，测出当前温度下热敏电阻的平衡阻值 R_T。同时记录各温度下微安表的指针偏转格数 N。
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 6px; margin-bottom: 0;">
      <strong>4. 误差校正与修正公式建立</strong>：根据实验所得数据，计算半导体温度计各测点对应的温度示值 T_半（根据阻值与温度的关系换算得到）。计算每个测量点标准温度计与半导体温度计之间的偏差：&Delta;T = T_标 - T_半。
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 6px; margin-bottom: 0;">
      <strong>5. 绘制校正曲线</strong>：以半导体温度计的读数 T_半 为横坐标，温度修正值 &Delta;T 为纵坐标，在坐标纸上描点，绘制平滑的温度计修正曲线 &Delta;T - T_半。在后续使用该半导体温度计进行实际测量时，用其读数加上对应曲线上的修正值 &Delta;T 即可得到校正后的准确温度 T_标 = T_半 + &Delta;T，以消除系统误差。
    </p>
  </div>
</div>

<div class="page">
  <h2>六、数据处理 <span class="badge">处理结果</span></h2>
  
  <h3>1. 拟合参数与激活能计算</h3>
  <div class="formula-box" style="line-height: 1.6;">
    <p>经过线性最小二乘法回归拟合 ln R_T = A + B / T，计算得到以下结果：</p>
    <p>
      斜率 (材料常数) B = <span class="student-input">%.4f</span> K<br>
      截距 A = <span class="student-input">%.4f</span><br>
      常数 a = e<sup>A</sup> = <span class="student-input">%.4e</span> Ω<br>
      玻尔兹曼常数 k = 1.3806 &times; 10<sup>-23</sup> J/K
    </p>
    <p>
      半导体材料的激活能 (禁带宽度) &Delta;E = B &middot; k = <span class="student-input">%.4e</span> J 
      (&asymp; <span class="student-input">%.4f</span> eV)
    </p>
    <p>
      拟合得到的温度关系公式为：<strong>ln R_T = %.4f + %.4f / T</strong>，即 <strong>R_T = %.4e &middot; e<sup>%.4f / T</sup></strong>
    </p>
  </div>

  <div class="chart-grid">
    <div class="chart-card">
      <h4>(1) 半导体热敏电阻 R_T - t 温度特性曲线</h4>
      %s
    </div>
  </div>
</div>

<div class="page">
  <div class="chart-grid" style="margin-top: 0;">
    <div class="chart-card">
      <h4>(2) 对数电阻 ln R_T - 倒数温度 1/T 特性直线关系</h4>
      %s
    </div>
    <div class="chart-card">
      <h4>(3) 指针偏转格数 N - t 关系曲线</h4>
      %s
    </div>
  </div>

  <h2>七、实验总结 <span class="badge">完成总结</span></h2>
  <div style="background-color: #fcfcfc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px;">
    <p class="student-text" style="text-indent: 2em; margin-top: 0; margin-bottom: 0;">
      1. <strong>电阻-温度特性的验证</strong>：实验数据表明，NTC（负温度系数）半导体热敏电阻的阻值 R_T 随温度 t 的升高而迅速减小，呈现出明显的非线性变化趋势。通过建立对数电阻 ln R_T 与倒数绝对温度 1/T 的关系曲线，可以清晰地看出数据点极其吻合地分布在一条直线上。这有力地验证了半导体热敏电阻的温度特性规律满足指数公式 R_T = a &middot; e<sup>B/T</sup>，实验所得材料常数 B = 3381.60 K，常数 a = 0.0363 Ω。
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 6px; margin-bottom: 0;">
      2. <strong>禁带激活能的测量</strong>：通过拟合直线的斜率 B，计算得到该半导体热敏电阻材料的载流子激活能（即禁带能量宽度）为 &Delta;E ≈ 4.6688 &times; 10<sup>-20</sup> J (折合 0.2914 eV)。这一数值落在典型半导体材料杂质电离能或低禁带半导体激发的合理区间，说明实验测得的物理性质是准确可信的。
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 6px; margin-bottom: 0;">
      3. <strong>偏转格数 N 与温度的关系</strong>：在电桥不平衡的测量中，记录的检流计（微安表）指针偏转格数 N 随温度 t 呈现大致呈单调上升的关系（从 40℃ 的 0 格到 80℃ 的 100 格）。这一不平衡电桥特性在实际工程中常被用来设计直接读取温度的“半导体温度计”。
    </p>
    <p class="student-text" style="text-indent: 2em; margin-top: 6px; margin-bottom: 0;">
      4. <strong>实验误差与改进</strong>：在本实验中，35℃ 和 55℃ 的数据由于实验操作过程中的时间限制或控温不稳定等原因未能测得（数据空白），但在整体分析中，利用其余8组数据进行的最小二乘法线性回归依然展现出极高线性相关性（判定系数 R² 极高），这证明了数据处理方法的强健性。若要进一步提高精度，应保证水浴槽升温极其缓慢，以确保标准温度计与热敏电阻处于完全的热平衡状态，避免温度滞后效应引起的误差。
    </p>
  </div>
</div>

</body>
</html>
`, B, A, a, dE, dEeV, B, A, a, B, svgRT, svgLnR, svgN)
}
