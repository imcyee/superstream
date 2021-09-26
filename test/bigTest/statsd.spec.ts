import SDC from 'statsd-client'

const sdc = new SDC({ host: '127.0.0.1', port: 8125 });



describe('statsd', () => {
  it('client', async () => {

    // running in background
    sdc.increment('some.counter'); // Increment by one.
    sdc.increment('some.counter'); // Increment by one.
    sdc.decrement('systemname.subsystem.value', -10); // Decrement by 10 
    sdc.counter('systemname.subsystem.value', 100); // Increment by 100

    await new Promise((r) => {
      setTimeout(r, 2000)
    })
  })
})

