import { GetStaticPaths, GetStaticProps } from 'next'
import { useRouter } from 'next/router'
import { Statsig } from 'statsig-react'
import Image from 'next/image'
import Cookie from 'js-cookie'
import {
  Layout,
  Text,
  Page,
  Button,
  Link,
  Snippet,
  Code,
} from '@vercel/examples-ui'
import { FEATURE_FLAG, EXPERIMENT, UID_COOKIE, GROUP_PARAM_FALLBACK } from '../lib/constants'
import api from '../lib/statsig-api'

interface Props {
  bucket: string
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  return {
    props: {
      bucket: params?.bucket as string,
    },
  }
}

export const getStaticPaths: GetStaticPaths<{ bucket: string }> = async () => {
  // Groups that we want to statically generate
  const groups: string[] = (await api.getBuckets(EXPERIMENT))
    .concat(GROUP_PARAM_FALLBACK)
    .filter(Boolean)

  return {
    paths: groups.map((group) => ({ params: { bucket: group } })),
    fallback: 'blocking',
  }
}

function BucketPage({ bucket }: Props) {
  // read a value from the client side cookie
  const featureFlagStatus = Cookie.get(FEATURE_FLAG) || 'false'
  
  const { push } = useRouter()

  function resetBucket() {
    Cookie.remove(UID_COOKIE)
    Statsig.logEvent('reset-bucket')
    push('/')
  }

  return (
    <Page className="flex flex-col gap-12">
      <section className="flex flex-col gap-6">
        <Text variant="h1">Performant experimentation with Statsig</Text>
        <Text>
          In this demo we use Statsig&apos;s Server SDK at the edge to pull
          experiment variants and show the resulting allocation. We leverage the{' '}
          <Link href="https://vercel.com/integrations/statsig" target="_blank">
            edge config integration
          </Link>{' '}
          to pull Statsig configurations from the edge. As long as you have a
          bucket assigned you will always see the same result, otherwise you
          will be assigned a bucket to mantain the odds specified in the
          experiment.
        </Text>
        <Text>
          Buckets are statically generated at build time in a{' '}
          <Code>/[bucket]</Code> page so its fast to rewrite to them. Take a
          look at the <Code>middleware.ts</Code> file to know more.
        </Text>
        <Text>
          You can reset the bucket multiple times to get a different bucket
          assigned. You can configure your experiments, see diagnostics and
          results in your account.{' '}
          <Link href="https://console.statsig.com/" target="_blank">
            Statsig console
          </Link>
          .
        </Text>
        <pre className="bg-black text-white font-mono text-left py-2 px-4 rounded-lg text-sm leading-6">
          bucket:{' '}
          {bucket === GROUP_PARAM_FALLBACK
            ? 'Experiment not set up, please read README to set up example.'
            : bucket}
          {}
        </pre>

        <pre className="bg-black text-white font-mono text-left py-2 px-4 rounded-lg text-sm leading-6">
          feature flag `vercel_edge`:{' '}
          {featureFlagStatus === 'true' ? 'on' : 'off'}
        </pre>

        <Button size="lg" onClick={resetBucket}>
          Reset bucket and revisit site
        </Button>
        <Text>
          In order to set this demo up yourself, in the <Link href="https://console.statsig.com/" target="_blank">
            Statsig console
          </Link>, create a new experiment called &quot;statsig_example&quot;. 
          Create experiment groups, each with a &quot;bucket&quot; parameter. 
          Make sure to start the experiment, and from there this example will display the bucket that the user was assigned to.
          See the screenshot below for an example experiment setup.
        </Text>

      </section>
    </Page>
  )
}

BucketPage.Layout = Layout

export default BucketPage
