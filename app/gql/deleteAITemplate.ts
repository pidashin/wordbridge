import { gql } from '@apollo/client';

export const DELETE_AI_TEMPLATE = gql`
  mutation DeleteAITemplate($word: String!) {
    deleteAITemplate(word: $word)
  }
`;

export default DELETE_AI_TEMPLATE;
