import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 32,
  },
  hero: {
    gap: 12,
  },
  headline: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  buttons: {
    gap: 12,
    marginTop: 4,
  },
  button: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

