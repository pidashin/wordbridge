import { gql } from '@apollo/client';

export const GET_USERS = gql`
  query GetUsers {
    getUsers {
      id
      username
      createdAt
    }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($username: String!) {
    createUser(username: $username) {
      id
      username
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;

export const GET_EXAM_HISTORY = gql`
  query GetExamHistory($userId: String!) {
    getExamHistory(userId: $userId) {
      id
      score
      mode
      createdAt
    }
  }
`;

export const SAVE_EXAM_RESULT = gql`
  mutation SaveExamResult(
    $userId: String!
    $score: Int!
    $mode: String!
    $wrongAnswers: String!
  ) {
    saveExamResult(
      userId: $userId
      score: $score
      mode: $mode
      wrongAnswers: $wrongAnswers
    ) {
      id
    }
  }
`;
