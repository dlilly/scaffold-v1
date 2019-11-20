import React from 'react'
import Button from '@material-ui/core/Button';
import Container from '@material-ui/core/Container';

class App extends React.Component {
  render() {
    return (
      <Container maxWidth="md">
        <Button variant="contained" color="primary">
          Hello World
        </Button>
      </Container>
    )
  }
}
export default App