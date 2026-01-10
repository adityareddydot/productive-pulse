/**
 * Analytics Module - Process logs into charts and stats
 */

class Analytics {
    constructor() {
        this.chart = null;
    }

    // Calculate productivity stats from logs
    calculateStats(logs, intervalHours = 1) {
        const stats = {
            productiveHours: 0,
            wastedHours: 0,
            moderateHours: 0,
            unknownHours: 0,
            totalLogged: logs.length,
            averageProductivity: 0,
            categoryBreakdown: {}
        };

        if (logs.length === 0) {
            return stats;
        }

        let totalProductivity = 0;

        logs.forEach(log => {
            const hours = intervalHours;

            switch (log.productivity) {
                case 4: // Green - highly productive
                case 3: // Light green - moderate
                    stats.productiveHours += hours;
                    break;
                case 2: // Orange - low focus
                    stats.moderateHours += hours;
                    break;
                case 1: // Red - not productive
                    stats.wastedHours += hours;
                    break;
                default:
                    stats.unknownHours += hours;
            }

            totalProductivity += log.productivity || 0;

            // Category breakdown
            if (log.category) {
                if (!stats.categoryBreakdown[log.category]) {
                    stats.categoryBreakdown[log.category] = 0;
                }
                stats.categoryBreakdown[log.category] += hours;
            }
        });

        stats.averageProductivity = totalProductivity / logs.length;

        return stats;
    }

    // Get color for productivity level
    getProductivityColor(level) {
        const colors = {
            0: '#636e72', // Unknown - gray
            1: '#ff4757', // Red
            2: '#ffa502', // Orange
            3: '#7bed9f', // Light green
            4: '#2ed573'  // Green
        };
        return colors[level] || colors[0];
    }

    // Get emoji for productivity level
    getProductivityEmoji(level) {
        const emojis = {
            0: '❓',
            1: '😫',
            2: '😕',
            3: '🙂',
            4: '🚀'
        };
        return emojis[level] || emojis[0];
    }

    // Category colors for pie chart
    getCategoryColors() {
        return {
            'deep-work': '#6366f1',
            'light-work': '#8b5cf6',
            'eating': '#f59e0b',
            'rest': '#6366f1',
            'leisure': '#ec4899',
            'other': '#64748b'
        };
    }

    // Render pie chart using Canvas
    renderPieChart(canvas, categoryBreakdown, categories) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth * 2;
        const height = canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2); // For retina displays

        const centerX = canvas.offsetWidth / 2;
        const centerY = canvas.offsetHeight / 2;
        const radius = Math.min(centerX, centerY) - 10;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        const data = Object.entries(categoryBreakdown);

        if (data.length === 0) {
            // Draw empty state
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data yet', centerX, centerY);
            return [];
        }

        const total = data.reduce((sum, [, value]) => sum + value, 0);
        const categoryColors = this.getCategoryColors();
        let currentAngle = -Math.PI / 2; // Start from top

        const legendData = [];

        data.forEach(([categoryId, value]) => {
            const sliceAngle = (value / total) * Math.PI * 2;
            const category = categories.find(c => c.id === categoryId) || { name: categoryId, emoji: '📦' };
            const color = categoryColors[categoryId] || '#64748b';

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // Add to legend
            legendData.push({
                name: category.name,
                emoji: category.emoji,
                color,
                percentage: Math.round((value / total) * 100),
                hours: value
            });

            currentAngle += sliceAngle;
        });

        // Draw center hole for donut effect
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#0f0f23';
        ctx.fill();

        return legendData;
    }

    // Update chart legend
    updateLegend(container, legendData) {
        container.innerHTML = '';

        if (legendData.length === 0) {
            container.innerHTML = '<div class="no-data">Log your first hour to see categories</div>';
            return;
        }

        legendData.forEach(item => {
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `
        <span class="legend-color" style="background: ${item.color}"></span>
        <span>${item.emoji} ${item.percentage}%</span>
      `;
            container.appendChild(div);
        });
    }

    // Format hours display
    formatHours(hours) {
        if (hours === 0) return '0h';
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        return `${hours}h`;
    }
}

// Global analytics instance
const analytics = new Analytics();
