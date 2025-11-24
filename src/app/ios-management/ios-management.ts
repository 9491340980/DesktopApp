import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
@Component({
  selector: 'app-ios-management',
  imports: [CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule],
  templateUrl: './ios-management.html',
  styleUrl: './ios-management.scss',
})



export class IosManagement {
 @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('exportContainer', { static: false }) exportContainer!: ElementRef<HTMLDivElement>;

  processSteps: ProcessStep[] = [];
  chartPoints: ChartPoint[] = [];
  totalSteps = 0;
  totalDuration = '';
  longestStep = '';
  longestStepDuration = 0;

  hoveredPoint: ChartPoint | null = null;
  tooltipX = 0;
  tooltipY = 0;
  showTooltip = false;

  // Chart dimensions
  private readonly CHART_WIDTH = 1100;
  private readonly CHART_HEIGHT = 500;
  private readonly PADDING_LEFT = 80;
  private readonly PADDING_RIGHT = 50;
  private readonly PADDING_TOP = 80; // Increased for legend
  private readonly PADDING_BOTTOM = 150;

  constructor() {
    this.loadSampleData();
  }

  loadSampleData() {
    this.processSteps = [
      { step: 'Connected', timestamp: '2025-11-20 6:28:04', duration: 0 },
      { step: 'Detected', timestamp: '2025-11-20 6:28:18', duration: 14.50029 },
      { step: 'CheckOrderReference', timestamp: '2025-11-20 6:28:19', duration: 1.125 },
      { step: 'PerformAppleAPICalls', timestamp: '2025-11-20 6:28:22', duration: 2.954 },
      { step: 'ValidateSerialNumber', timestamp: '2025-11-20 6:28:24', duration: 1.657997 },
      { step: 'MasterModelLookup', timestamp: '2025-11-20 6:28:24', duration: 0.45083 },
      { step: 'GetConditions', timestamp: '2025-11-20 6:28:24', duration: 0.227173 },
      { step: 'GetSKUBySerialNumber', timestamp: '2025-11-20 6:28:25', duration: 0.366 },
      { step: 'DetermineSKU', timestamp: '2025-11-20 6:28:25', duration: 0.624002 },
      { step: 'GetReceiptDetail', timestamp: '2025-11-20 6:28:26', duration: 0.580038 },
      { step: 'GetSAPRealtimeProgram', timestamp: '2025-11-20 6:28:27', duration: 1.25696 },
      { step: 'CheckPOPConditions', timestamp: '2025-11-20 6:28:28', duration: 0.429008 },
      { step: 'AddSerialNumber', timestamp: '2025-11-20 6:28:30', duration: 2.753025 },
      { step: 'Received', timestamp: '2025-11-20 6:28:30', duration: 0 },
      { step: 'Waiting for prioritize', timestamp: '2025-11-20 6:28:46', duration: 15.248 },
      { step: 'GetSurvey', timestamp: '2025-11-20 6:28:47', duration: 1.104 },
      { step: 'Load pre-receiving qualification values', timestamp: '2025-11-20 6:28:49', duration: 2.146 },
      { step: 'Get refreshed survey', timestamp: '2025-11-20 6:28:50', duration: 1.524 },
      { step: 'Get refreshed survey', timestamp: '2025-11-20 6:28:52', duration: 1.621 },
      { step: 'Get refreshed survey', timestamp: '2025-11-20 6:28:53', duration: 1.247 },
      { step: 'Get refreshed survey', timestamp: '2025-11-20 6:28:55', duration: 1.342 },
      { step: 'Get refreshed survey', timestamp: '2025-11-20 6:28:56', duration: 1.226 },
      { step: 'Get refreshed survey', timestamp: '2025-11-20 6:28:57', duration: 1.354 },
      { step: 'Submit survey', timestamp: '2025-11-20 6:28:59', duration: 1.243 },
      { step: 'Process Survey', timestamp: '2025-11-20 6:29:02', duration: 3.214 },
      { step: 'ValidateAndUpdateDevice', timestamp: '2025-11-20 6:29:04', duration: 2.245 },
      { step: 'Identified test profile and sending to FD', timestamp: '2025-11-20 6:29:05', duration: 0.564 },
      { step: 'Qualification Completed', timestamp: '2025-11-20 6:29:08', duration: 3.681271 },
      { step: 'Result received', timestamp: '2025-11-20 6:34:09', duration: 300.711727 },
      { step: 'Validate test serialumber', timestamp: '2025-11-20 6:34:09', duration: 0.554031 },
      { step: 'Process data elements', timestamp: '2025-11-20 6:34:10', duration: 0.624967 },
      { step: 'Save result_json', timestamp: '2025-11-20 6:34:12', duration: 1.524006 },
      { step: 'Get eligible transaction (API)', timestamp: '2025-11-20 6:34:12', duration: 0.812024 },
      { step: 'Get trans attribute values (API)', timestamp: '2025-11-20 6:34:13', duration: 0.92398 },
      { step: 'Get trans attribute values (API)', timestamp: '2025-11-20 6:34:14', duration: 0.958004 },
      { step: 'Process transactions (API)', timestamp: '2025-11-20 6:34:15', duration: 1.13516 },
      { step: 'Result processing Completed', timestamp: '2025-11-20 6:34:15', duration: 0 },
      { step: 'Waiting for prioritize ADP', timestamp: '2025-11-20 6:44:06', duration: 590.130345 },
      { step: 'validateTestSerialNumber', timestamp: '2025-11-20 6:44:06', duration: 0.621154 },
      { step: '2D label printing', timestamp: '2025-11-20 6:44:07', duration: 0.905078 },
      { step: 'Load test results', timestamp: '2025-11-20 6:44:08', duration: 1.253938 },
      { step: 'Validate scanned 2D label', timestamp: '2025-11-20 6:44:10', duration: 1.906436 },
      { step: 'Suggesting container', timestamp: '2025-11-20 6:44:26', duration: 15.970285 },
      { step: 'Validate scanned container', timestamp: '2025-11-20 6:44:27', duration: 0.26102 },
      { step: 'Validate and Move device', timestamp: '2025-11-20 6:44:30', duration: 3.494025 },
      { step: 'Moved to Container', timestamp: '2025-11-20 6:44:30', duration: 0 }
    ];

    this.calculateStatistics();
    this.generateChartPoints();
    setTimeout(() => this.drawChart(), 100);
  }

  onFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

        // Map the data to our format
        this.processSteps = jsonData.map((row: any) => {
          // Support multiple column name formats
          const stepName = row['Step name'] || row['Step'] || row['step'] || '';
          
          // Handle timestamp - could be string or Date object
          let timestampStr = row['Time Stamp'] || row['Timestamp'] || row['timestamp'] || '';
          
          // If timestamp is a number (Excel serial date), convert it
          if (typeof timestampStr === 'number') {
            // Excel serial date conversion
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + timestampStr * 86400000);
            timestampStr = date.toLocaleString();
          } else if (timestampStr instanceof Date) {
            timestampStr = timestampStr.toLocaleString();
          }
          
          // Get duration - check if it's in milliseconds or seconds
          let durationValue = parseFloat(
            row['Duration (milli seconds)'] || 
            row['Duration (Milliseconds)'] ||
            row['Duration (milliseconds)'] ||
            row['Duration (Seconds)'] || 
            row['Duration'] || 
            row['duration'] || 
            0
          );

          // Convert milliseconds to seconds if the column name indicates milliseconds
          if (row['Duration (milli seconds)'] !== undefined || 
              row['Duration (Milliseconds)'] !== undefined ||
              row['Duration (milliseconds)'] !== undefined) {
            // Values are in milliseconds - convert to seconds
            durationValue = durationValue / 1000;
          }
          // Otherwise, assume values are already in seconds (backward compatibility)

          return {
            step: stepName,
            timestamp: timestampStr.toString(),
            duration: durationValue // Now in seconds
          };
        });

        this.calculateStatistics();
        this.generateChartPoints();
        setTimeout(() => this.drawChart(), 100);
      };

      reader.readAsArrayBuffer(file);
    }
  }

  calculateStatistics() {
    this.totalSteps = this.processSteps.length;

    const totalSeconds = this.processSteps.reduce((sum, step) => sum + step.duration, 0);
    const minutes = Math.floor(totalSeconds / 60);
    this.totalDuration = `${minutes}m`;

    let maxDuration = 0;
    let maxStep = '';
    this.processSteps.forEach(step => {
      if (step.duration > maxDuration) {
        maxDuration = step.duration;
        maxStep = step.step;
      }
    });
    this.longestStepDuration = maxDuration;
    this.longestStep = `${maxDuration.toFixed(1)}s`;
  }

  generateChartPoints() {
    let cumulativeTime = 0;
    this.chartPoints = [];

    this.processSteps.forEach((step, index) => {
      const point: ChartPoint = {
        x: index,
        y: cumulativeTime,
        step: step.step,
        duration: step.duration,
        timestamp: step.timestamp,
        timeDifference: index > 0 ? step.duration : 0
      };
      this.chartPoints.push(point);
      cumulativeTime += step.duration;
    });

    // Add final point
    if (this.processSteps.length > 0) {
      const lastStep = this.processSteps[this.processSteps.length - 1];
      this.chartPoints.push({
        x: this.processSteps.length,
        y: cumulativeTime,
        step: lastStep.step,
        duration: lastStep.duration,
        timestamp: lastStep.timestamp,
        timeDifference: lastStep.duration
      });
    }
  }

  drawChart() {
    if (!this.chartCanvas) return;

    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = this.CHART_WIDTH;
    canvas.height = this.CHART_HEIGHT;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate scales
    const maxY = Math.max(...this.chartPoints.map(p => p.y));
    const chartWidth = this.CHART_WIDTH - this.PADDING_LEFT - this.PADDING_RIGHT;
    const chartHeight = this.CHART_HEIGHT - this.PADDING_TOP - this.PADDING_BOTTOM;

    const scaleX = chartWidth / (this.chartPoints.length - 1);
    const scaleY = chartHeight / maxY;

    // Draw grid
    this.drawGrid(ctx, chartWidth, chartHeight, maxY);

    // Draw line
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();

    this.chartPoints.forEach((point, index) => {
      const x = this.PADDING_LEFT + point.x * scaleX;
      const y = this.CHART_HEIGHT - this.PADDING_BOTTOM - point.y * scaleY;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    this.chartPoints.forEach((point, index) => {
      const x = this.PADDING_LEFT + point.x * scaleX;
      const y = this.CHART_HEIGHT - this.PADDING_BOTTOM - point.y * scaleY;

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw time difference labels with vertical text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 1; i < this.processSteps.length; i++) {
      const prevPoint = this.chartPoints[i - 1];
      const currPoint = this.chartPoints[i];
      
      if (currPoint.timeDifference && currPoint.timeDifference > 0) {
        const x1 = this.PADDING_LEFT + prevPoint.x * scaleX;
        const y1 = this.CHART_HEIGHT - this.PADDING_BOTTOM - prevPoint.y * scaleY;
        const x2 = this.PADDING_LEFT + currPoint.x * scaleX;
        const y2 = this.CHART_HEIGHT - this.PADDING_BOTTOM - currPoint.y * scaleY;
        
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        
        // Determine if line is going up
        const isGoingUp = y2 < y1;
        
        // Format the time difference
        const timeDiff = currPoint.timeDifference;
        let label = '';
        let isHighlight = false;
        
        if (timeDiff < 1) {
          // Less than 1 second - show in milliseconds
          label = `+${(timeDiff * 1000).toFixed(0)}ms`;
        } else if (timeDiff < 60) {
          // Less than 1 minute - show in seconds
          label = `+${timeDiff.toFixed(2)}s`;
          if (timeDiff > 10) isHighlight = true;
        } else if (timeDiff < 3600) {
          // Less than 1 hour - show in minutes and seconds
          const minutes = Math.floor(timeDiff / 60);
          const seconds = Math.round(timeDiff % 60);
          label = `+${minutes}m ${seconds}s`;
          isHighlight = true;
        } else {
          // 1 hour or more - show in hours, minutes, and seconds
          const hours = Math.floor(timeDiff / 3600);
          const minutes = Math.floor((timeDiff % 3600) / 60);
          const seconds = Math.round(timeDiff % 60);
          label = `+${hours}h ${minutes}m ${seconds}s`;
          isHighlight = true;
        }
        
        // Set font and measure text (increased size)
        ctx.font = isHighlight ? 'bold 11px Arial' : 'bold 10px Arial';
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        
        // Calculate position
        let labelY;
        const baseOffset = 35;
        
        if (isGoingUp) {
          labelY = Math.min(midY + textWidth / 2 + baseOffset, this.CHART_HEIGHT - this.PADDING_BOTTOM - 60);
        } else {
          const minDistanceFromBottom = 80;
          const calculatedY = midY - textWidth / 2 - baseOffset;
          const bottomThreshold = this.CHART_HEIGHT - this.PADDING_BOTTOM - minDistanceFromBottom;
          labelY = Math.min(calculatedY, bottomThreshold);
        }
        
        // Validate bounds - skip if outside chart area
        if (labelY >= this.PADDING_TOP + 20 && labelY <= this.CHART_HEIGHT - this.PADDING_BOTTOM - 20) {
          // Set color
          ctx.fillStyle = isHighlight ? '#d32f2f' : '#e64a19';
          
          // Draw vertical text
          ctx.save();
          ctx.translate(midX, labelY);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
    }

    // Draw x-axis labels (rotated step names)
    ctx.fillStyle = '#000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';

    this.processSteps.forEach((step, index) => {
      const x = this.PADDING_LEFT + index * scaleX;
      const y = this.CHART_HEIGHT - this.PADDING_BOTTOM + 10;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(step.step, 0, 0);
      ctx.restore();
    });

    // Draw y-axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const value = (maxY / ySteps) * i;
      const y = this.CHART_HEIGHT - this.PADDING_BOTTOM - value * scaleY;
      ctx.fillText(Math.round(value).toString(), this.PADDING_LEFT - 10, y);
    }

    // Draw axis titles
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Process Steps', this.CHART_WIDTH / 2, this.CHART_HEIGHT - 10);

    ctx.save();
    ctx.translate(20, this.CHART_HEIGHT / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Time Taken (Seconds)', 0, 0);
    ctx.restore();

    // Draw legend at top-left corner
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    
    // Main line legend - moved to top-left
    // ctx.fillStyle = '#000';
    // ctx.fillRect(this.PADDING_LEFT + 10, 20, 15, 15);
    ctx.fillText('Cumulative Time (seconds)', this.PADDING_LEFT + 50, 50);
    
    // Time difference legend (vertical red text) - below cumulative time legend
    ctx.save();
    ctx.translate(this.PADDING_LEFT + 17, 60);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#e64a19';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('+1.5s', 0, 0);
    ctx.restore();
    
    // ctx.fillStyle = '#000';
    // ctx.fillText('Time Difference (vertical)', this.PADDING_LEFT + 30, 60);
  }

  drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, maxY: number) {
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = this.CHART_HEIGHT - this.PADDING_BOTTOM - (height / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(this.PADDING_LEFT, y);
      ctx.lineTo(this.PADDING_LEFT + width, y);
      ctx.stroke();
    }

    // Vertical grid lines
    this.processSteps.forEach((_, index) => {
      const x = this.PADDING_LEFT + index * (width / (this.chartPoints.length - 1));
      ctx.beginPath();
      ctx.moveTo(x, this.PADDING_TOP);
      ctx.lineTo(x, this.CHART_HEIGHT - this.PADDING_BOTTOM);
      ctx.stroke();
    });
  }

  onCanvasMouseMove(event: MouseEvent) {
    const canvas = this.chartCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const chartWidth = this.CHART_WIDTH - this.PADDING_LEFT - this.PADDING_RIGHT;
    const chartHeight = this.CHART_HEIGHT - this.PADDING_TOP - this.PADDING_BOTTOM;
    const maxY = Math.max(...this.chartPoints.map(p => p.y));
    const scaleX = chartWidth / (this.chartPoints.length - 1);
    const scaleY = chartHeight / maxY;

    let foundPoint = null;
    const threshold = 10;

    for (const point of this.chartPoints) {
      const x = this.PADDING_LEFT + point.x * scaleX;
      const y = this.CHART_HEIGHT - this.PADDING_BOTTOM - point.y * scaleY;

      const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
      if (distance < threshold) {
        foundPoint = point;
        this.tooltipX = event.clientX;
        this.tooltipY = event.clientY;
        break;
      }
    }

    this.hoveredPoint = foundPoint;
    this.showTooltip = foundPoint !== null;
  }

  onCanvasMouseLeave() {
    this.showTooltip = false;
    this.hoveredPoint = null;
  }

  async exportAsPDF() {
    const container = this.exportContainer.nativeElement;
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save('rmx-timeline.pdf');
  }

  async exportAsJPG() {
    const container = this.exportContainer.nativeElement;
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff'
    });

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'rmx-timeline.jpg';
        link.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/jpeg', 0.95);
  }
}






interface ProcessStep {
  step: string;
  timestamp: string;
  duration: number;
}

interface ChartPoint {
  x: number;
  y: number;
  step: string;
  duration: number;
  timestamp: string;
  timeDifference?: number;
}
