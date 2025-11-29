'use client'

import { useState, useEffect } from 'react'
import { X, Check, Plus, Sparkles, ChevronRight } from 'lucide-react'
import { ProjectTemplate, TemplateCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: ProjectTemplate, features: string[], customRequirements: string, projectName: string) => void
}

export function TemplateSelector({ isOpen, onClose, onSelectTemplate }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [customRequirements, setCustomRequirements] = useState('')
  const [projectName, setProjectName] = useState('')
  const [step, setStep] = useState<'templates' | 'customize'>('templates')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
      fetchCategories()
    }
  }, [isOpen])

  const fetchTemplates = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/templates')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/templates/categories')
      const data = await response.json()
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template)
    setSelectedFeatures([...template.default_features])
    setProjectName(`My ${template.name}`)
    setStep('customize')
  }

  const toggleFeature = (feature: string) => {
    setSelectedFeatures(prev =>
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    )
  }

  const handleCreate = () => {
    if (selectedTemplate) {
      setLoading(true)
      onSelectTemplate(selectedTemplate, selectedFeatures, customRequirements, projectName)
      // Reset state
      setTimeout(() => {
        setLoading(false)
        handleClose()
      }, 500)
    }
  }

  const handleClose = () => {
    setStep('templates')
    setSelectedTemplate(null)
    setSelectedFeatures([])
    setCustomRequirements('')
    setProjectName('')
    setSelectedCategory(null)
    onClose()
  }

  const filteredTemplates = selectedCategory
    ? templates.filter(t => t.category === selectedCategory)
    : templates

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-mgx-bg rounded-2xl shadow-2xl 
                    border border-mgx-border overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mgx-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mgx-primary to-mgx-accent 
                          flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-mgx-text">
                {step === 'templates' ? 'Choose a Template' : 'Customize Your Project'}
              </h2>
              <p className="text-sm text-mgx-text-muted">
                {step === 'templates' 
                  ? 'Start with a pre-built template for faster development' 
                  : `Configuring ${selectedTemplate?.name}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-mgx-surface-light transition-colors"
          >
            <X className="w-5 h-5 text-mgx-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'templates' ? (
            <div className="space-y-6">
              {/* Category Filter */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    !selectedCategory
                      ? 'bg-mgx-primary text-white'
                      : 'bg-mgx-surface text-mgx-text-muted hover:bg-mgx-surface-light'
                  )}
                >
                  All Templates
                </button>
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                      selectedCategory === category.id
                        ? 'bg-mgx-primary text-white'
                        : 'bg-mgx-surface text-mgx-text-muted hover:bg-mgx-surface-light'
                    )}
                  >
                    <span>{category.icon}</span>
                    {category.name}
                  </button>
                ))}
              </div>

              {/* Template Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="group p-4 rounded-xl bg-mgx-surface border border-mgx-border
                             hover:border-mgx-primary/50 hover:bg-mgx-surface-light
                             transition-all duration-200 text-left"
                  >
                    <div className="text-3xl mb-3">{template.icon}</div>
                    <h3 className="font-medium text-mgx-text mb-1 group-hover:text-mgx-primary transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-sm text-mgx-text-muted line-clamp-2">
                      {template.description}
                    </p>
                    <div className="mt-3 flex items-center text-xs text-mgx-accent opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Customize</span>
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Selected Template Info */}
              <div className="flex items-center gap-4 p-4 bg-mgx-surface rounded-xl border border-mgx-border">
                <div className="text-4xl">{selectedTemplate?.icon}</div>
                <div>
                  <h3 className="font-medium text-mgx-text">{selectedTemplate?.name}</h3>
                  <p className="text-sm text-mgx-text-muted">{selectedTemplate?.description}</p>
                </div>
                <button
                  onClick={() => setStep('templates')}
                  className="ml-auto text-sm text-mgx-accent hover:underline"
                >
                  Change
                </button>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-mgx-text mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  className="w-full px-4 py-3 bg-mgx-surface border border-mgx-border rounded-xl
                           text-mgx-text placeholder-mgx-text-muted
                           focus:border-mgx-primary/50 focus:ring-2 focus:ring-mgx-primary/20
                           outline-none transition-all"
                />
              </div>

              {/* Features Selection */}
              <div>
                <label className="block text-sm font-medium text-mgx-text mb-2">
                  Select Features
                </label>
                <div className="space-y-2">
                  <p className="text-xs text-mgx-text-muted mb-2">Default features (included):</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate?.default_features.map(feature => (
                      <button
                        key={feature}
                        onClick={() => toggleFeature(feature)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all',
                          selectedFeatures.includes(feature)
                            ? 'bg-mgx-primary/20 text-mgx-primary border border-mgx-primary/30'
                            : 'bg-mgx-surface text-mgx-text-muted border border-mgx-border'
                        )}
                      >
                        {selectedFeatures.includes(feature) && <Check className="w-3 h-3" />}
                        {feature}
                      </button>
                    ))}
                  </div>
                  
                  <p className="text-xs text-mgx-text-muted mt-4 mb-2">Additional features (optional):</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate?.suggested_features.map(feature => (
                      <button
                        key={feature}
                        onClick={() => toggleFeature(feature)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all',
                          selectedFeatures.includes(feature)
                            ? 'bg-mgx-accent/20 text-mgx-accent border border-mgx-accent/30'
                            : 'bg-mgx-surface text-mgx-text-muted border border-mgx-border hover:border-mgx-accent/30'
                        )}
                      >
                        {selectedFeatures.includes(feature) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {feature}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Custom Requirements */}
              <div>
                <label className="block text-sm font-medium text-mgx-text mb-2">
                  Additional Requirements (Optional)
                </label>
                <textarea
                  value={customRequirements}
                  onChange={(e) => setCustomRequirements(e.target.value)}
                  placeholder="Add any specific requirements or customizations..."
                  rows={3}
                  className="w-full px-4 py-3 bg-mgx-surface border border-mgx-border rounded-xl
                           text-mgx-text placeholder-mgx-text-muted resize-none
                           focus:border-mgx-primary/50 focus:ring-2 focus:ring-mgx-primary/20
                           outline-none transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'customize' && (
          <div className="px-6 py-4 border-t border-mgx-border flex justify-end gap-3">
            <button
              onClick={() => setStep('templates')}
              className="px-5 py-2.5 rounded-lg text-mgx-text-muted hover:text-mgx-text
                       hover:bg-mgx-surface-light transition-all"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !projectName.trim()}
              className={cn(
                'px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2',
                loading || !projectName.trim()
                  ? 'bg-mgx-surface text-mgx-text-muted cursor-not-allowed'
                  : 'bg-mgx-primary hover:bg-mgx-primary-hover text-white shadow-lg shadow-mgx-primary/25'
              )}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Project
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

