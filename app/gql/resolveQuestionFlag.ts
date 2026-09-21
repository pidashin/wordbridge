import { gql } from '@apollo/client';

export const RESOLVE_QUESTION_FLAG = gql`
  mutation ResolveQuestionFlag($word: String!, $questionType: String) {
    resolveQuestionFlag(word: $word, questionType: $questionType)
  }
`;

export default RESOLVE_QUESTION_FLAG;
