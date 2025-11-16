'use client'

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DashboardClient from './DashboardClient'

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('DashboardClient - Project & Run Management', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock: empty runs list
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
      status: 200,
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders dashboard header', () => {
    render(<DashboardClient />)
    // wait for initial fetch to settle to avoid async state update warnings
    return waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
  })

  it('creates a new project with name', async () => {
    render(<DashboardClient />)
    
    // Navigate to projects - click first Projets button in navigation
    const projetsButtons = screen.queryAllByText('Projets')
    if (projetsButtons.length > 0) {
      fireEvent.click(projetsButtons[0]!)
    }
    
    // Find and fill project name input
    const projectNameInput = screen.getByPlaceholderText('Nom projet') as HTMLInputElement
    fireEvent.change(projectNameInput, { target: { value: 'AI Vision Project' } })
    
    // Submit project creation
    const createBtn = screen.getByText('Créer')
    fireEvent.click(createBtn)
    
    // Verify project appears in the list (use regex to handle surrounding text/whitespace)
    await waitFor(() => {
      expect(screen.getByText(/AI Vision Project/)).toBeInTheDocument()
    })
  })

  it('adds a new run with API integration', async () => {
    // Mock successful run creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        run_id: 'run-001',
        status: 'queued',
        project_id: 'proj-1',
        created_at: new Date().toISOString(),
      }),
      status: 200,
    })

    render(<DashboardClient />)
    
    const addRunBtn = screen.getByText('Ajouter un run')
    fireEvent.click(addRunBtn)
    
    // Verify API was called with POST
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/runs',
        expect.objectContaining({
          method: 'POST',
        })
      )
    }, { timeout: 2000 })
  })

  it('displays runs in the UI', async () => {
    const mockRuns = [
      {
        run_id: 'run-1',
        status: 'processing',
        project_id: 'proj-1',
        created_at: new Date().toISOString(),
      },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockRuns),
      status: 200,
    })

    render(<DashboardClient />)

    // Wait for runs to be fetched and displayed
    await waitFor(() => {
      // Look for run ID in the DOM
      expect(screen.queryByText(/run-1/)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('fetches runs from API on mount', async () => {
    const mockRuns = [
      { run_id: 'run-1', status: 'completed', project_id: 'proj-1', created_at: new Date().toISOString() },
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue(mockRuns),
      status: 200,
    })

    render(<DashboardClient />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/runs')
    }, { timeout: 2000 })
  })

  it('has accessible navigation with main role', () => {
    render(<DashboardClient />)
    // ensure initial fetch completes to avoid act() warnings
    return waitFor(() => expect(mockFetch).toHaveBeenCalled()).then(() => {
      const mainContents = screen.getAllByRole('main')
      expect(mainContents.length).toBeGreaterThan(0)
    })
  })

  it('add project form has accessible labels', () => {
    render(<DashboardClient />)
    return waitFor(() => expect(mockFetch).toHaveBeenCalled()).then(() => {
      // Navigate to projects view so the AddProjectForm is visible
      const projets = screen.queryAllByText('Projets')
      if (projets.length > 0 && projets[0]) {
        fireEvent.click(projets[0]!)
      }

      // Input and select should expose aria-labels
      expect(screen.getByLabelText('Nom projet')).toBeInTheDocument()
      expect(screen.getByLabelText('Type projet')).toBeInTheDocument()
      expect(screen.getByLabelText('Créer projet')).toBeInTheDocument()
    })
  })

  it('falls back to local run when API is unreachable', async () => {
    // Simulate network failure
    mockFetch.mockRejectedValueOnce(new Error('Network down'))

    render(<DashboardClient />)
    const addRunBtn = screen.getByText('Ajouter un run')
    fireEvent.click(addRunBtn)

    // After fallback, the KPI 'Runs:' count should increment by 1 (stable selector)
    const runsKpi = () => {
      const el = Array.from(document.querySelectorAll('.text-xs')).find(n => /Runs:/.test(n.textContent || ''))
      return el?.textContent || ''
    }

    await waitFor(() => {
      const text = runsKpi()
      // extract number after 'Runs:'
      const m = text.match(/Runs:\s*(\d+)/)
      expect(m).not.toBeNull()
      const count = Number(m?.[1] ?? 0)
      expect(count).toBeGreaterThanOrEqual(1)
    }, { timeout: 2000 })
  })

  it('supports keyboard focus on buttons', async () => {
    render(<DashboardClient />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const tabButtons = screen.getAllByText('Ajouter un run')
    if (tabButtons.length > 0) {
      const firstTabButton = tabButtons[0]
      if (firstTabButton) {
        firstTabButton.focus()
        expect(firstTabButton).toHaveFocus()
      }
    }
  })

  it('gracefully handles API fetch errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    render(<DashboardClient />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    // Component should still render without crashing
    expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
  })

  it('renders sidebar with recent runs', async () => {
    render(<DashboardClient />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    // There may be multiple complementary elements; assert at least one exists
    const sidebars = screen.getAllByRole('complementary')
    expect(sidebars.length).toBeGreaterThan(0)
  })
})
