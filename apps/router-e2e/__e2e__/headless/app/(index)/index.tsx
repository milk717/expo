import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { MovieList } from '../../components/MovieList';

export default function Home() {
  return (
    <View style={styles.root}>
      <Text style={styles.header}>Home</Text>
      <Text style={styles.subheader}>Test pages</Text>
      <Link href="/tab-functions" style={styles.link}>
        Go to Tab functions
      </Link>
      <Text>You can reset to this tab by long pressing the tab button</Text>
      <Text style={styles.subheader}>Movies</Text>
      <View style={styles.listRoot}>
        <MovieList />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  link: {
    textDecorationLine: 'underline',
  },
  header: {
    fontSize: 62,
    marginBottom: 20,
    textDecorationLine: 'underline',
  },
  subheader: {
    fontSize: 24,
    marginVertical: 20,
  },
  listRoot: {
    flex: 1,
    flexShrink: 1,
    gap: 10,
  },
  listItem: {},
});
