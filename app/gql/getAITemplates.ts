// app/gql/getAITemplates.ts
import { gql } from '@apollo/client';

export const GET_AI_TEMPLATES = gql`
  query GetAITemplates {
    aiTemplates {
      word
      sentence
      options
      answer
    }
  }
`;

export default GET_AI_TEMPLATES;
