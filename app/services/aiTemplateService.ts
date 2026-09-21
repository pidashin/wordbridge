// AI Template Service
// This service loads AI-generated templates from the GraphQL API

export interface AITemplate {
  word: string;
  sentence: string;
  options: string[];
  answer: string;
}

class AITemplateService {
  private templates: AITemplate[] = [];
  private loaded = false;

  // Load AI templates from GraphQL API
  private async loadTemplates(): Promise<void> {
    if (this.loaded) return;

    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetAITemplates {
              aiTemplates {
                word
                sentence
                options
                answer
              }
            }
          `,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data.aiTemplates) {
          this.templates = result.data.aiTemplates;
          this.loaded = true;
          console.log(`✅ Loaded ${this.templates.length} AI templates`);
        } else {
          this.templates = [];
          this.loaded = true;
        }
      } else {
        console.log('ℹ️ No AI templates available, using fallback');
        this.templates = [];
        this.loaded = true;
      }
    } catch (error) {
      console.error('❌ Failed to load AI templates:', error);
      this.templates = [];
      this.loaded = true;
    }
  }

  // Get AI template for a specific word
  async getAITemplate(word: string): Promise<AITemplate | null> {
    await this.loadTemplates();
    return (
      this.templates.find((t) => t.word.toLowerCase() === word.toLowerCase()) ||
      null
    );
  }

  // Get all AI templates
  async getAllTemplates(): Promise<AITemplate[]> {
    await this.loadTemplates();
    return this.templates;
  }

  // Check if AI templates are available
  async hasTemplates(): Promise<boolean> {
    await this.loadTemplates();
    return this.templates.length > 0;
  }

  // Clear cache to force reload on next request
  clearCache(): void {
    this.loaded = false;
    this.templates = [];
    console.log('🔄 AI template cache cleared');
  }
}

// Export singleton instance
export const aiTemplateService = new AITemplateService();
