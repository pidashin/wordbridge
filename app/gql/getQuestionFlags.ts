import { gql } from '@apollo/client';

export const GET_QUESTION_FLAGS = gql`
  query GetQuestionFlags {
    questionFlags {
      word
      questionType
      questionText
      reason
      count
      createdAt
      updatedAt
    }
  }
`;

export default GET_QUESTION_FLAGS;
