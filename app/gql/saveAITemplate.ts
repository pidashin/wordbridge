import { gql } from '@apollo/client';

export const SAVE_AI_TEMPLATE = gql`
  mutation SaveAITemplate($template: AITemplateInput!) {
    saveAITemplate(template: $template) {
      word
      sentence
      options
      answer
    }
  }
`;

export default SAVE_AI_TEMPLATE;
