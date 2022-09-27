import React from 'react';
import Button from '@mui/material/Button';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { Stack, TextField, Typography } from '@mui/material';
import TreeView from '@mui/lab/TreeView';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TreeItem from '@mui/lab/TreeItem';

// Note: This line relies on Docker Desktop's presence as a host application.
// If you're running this React app in a browser, it won't work properly.
const client = createDockerDesktopClient();

function useDockerDesktopClient() {
  return client;
}

function formatBytes(bytes, decimals = 2) {
  // from https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

interface Manifest {
  Ref: string;
  Descriptor: Descriptor;
  SchemaV2Manifest: SchemaManifest;
}

interface Descriptor {
  mediaType: string;
  digest: string;
  size: number;
  platform: Platform;
}

interface Platform {
  architecture: string;
  os: string;
  osversion: string;
}

interface Layer {
  mediaType: string;
  size: number;
  digest: string;
  urls: string[];
}

interface Config {
  mediaType: string;
  size: number;
  digest: string;
}

interface SchemaManifest {
  schemaVersion: number;
  mediaType: string;
  config: Config;
  layers: Layer[];
}

export function App() {
  const [buttonText, setButtonText] = React.useState<string>();
  const [imagename, setImagename] = React.useState<string>();
  const [manifests, setManifests] = React.useState<Manifest[]>();
  const ddClient = useDockerDesktopClient();

  const fetchAndDisplayResponse = async () => {
    setButtonText("Loading ...")
    try {
      const manifestInfo = await ddClient.docker.cli.exec("manifest", [
        "inspect",
        imagename,
        "-v"
      ]);

      const parsedManifestInfo: Manifest | Manifest[] = manifestInfo.parseJsonObject();
      var localManifests: Manifest[];
      if (!Array.isArray(parsedManifestInfo)) {
        localManifests = [parsedManifestInfo];
      } else {
        localManifests = parsedManifestInfo;
      }
      setManifests(localManifests);
    } catch (e) {
      setManifests(undefined);
      ddClient.desktopUI.toast.error(e.stderr);
    }
    setButtonText(undefined);
  };

  function RenderResultTree() {
    if (manifests !== undefined) {
      return (
        <TreeView
          aria-label="image size view"
          defaultCollapseIcon={<ExpandMoreIcon />}
          defaultExpandIcon={<ChevronRightIcon />}
          sx={{ flexGrow: 1, overflowY: 'auto' }}
          disableSelection={true}
        >
          {
            manifests.map((manifest: Manifest, index: number) => {
              var localRef = manifest.Ref;
              if (localRef.indexOf("@") > 0)
                localRef = localRef.substring(0, localRef.indexOf("@"));

              localRef += ` (${manifest.Descriptor.platform.os} - ${manifest.Descriptor.platform.architecture}`;
              if (manifest.Descriptor.platform["os.version"] !== undefined)
                localRef += ` - ${manifest.Descriptor.platform["os.version"]}`;
              localRef += ")";

              var configSize = manifest.SchemaV2Manifest.config.size;
              var totalLayerSize = configSize;
              manifest.SchemaV2Manifest.layers.forEach((layer: Layer) => {
                totalLayerSize += layer.size;
              });
              var totalSize = configSize + totalLayerSize;

              return (
                <TreeItem nodeId={`${index}`} key={`${index}`} label={localRef}>
                  <TreeItem nodeId={`${index}-total`} key={`${index}-total`} label={`Total size: ${formatBytes(totalSize)}`} />
                  <TreeItem nodeId={`${index}-config`} key={`${index}-config`} label={`Config size: ${formatBytes(configSize)}`} />
                  <TreeItem nodeId={`${index}-layers`} key={`${index}-layers`} label={`Layers size: ${formatBytes(totalLayerSize)}`} >
                    {
                      manifest.SchemaV2Manifest.layers.map((layer: Layer, indexLayer: number) => {
                        return (
                          <TreeItem nodeId={`${index}-${indexLayer}-layer`} key={`${index}-${indexLayer}-layer`} label={`Layer size: ${formatBytes(layer.size)} ${layer.urls !== undefined ? " - external" : ""}`} />
                        );
                      })
                    }
                  </TreeItem>
                </TreeItem>
              );
            })
          }
        </TreeView>
      );
    }
  }

  const handleImagenameChange = event => {
    setImagename(event.target.value);
  };

  return (
    <>
      <Typography variant="h3">Docker image size</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
        This extension allows you to query any publicly available Docker image for its compressed size.
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
        Entering the name (and tag) of a Docker image in the entry field below and then pressing the button will retrieve and calculate the size.
      </Typography>
      <Stack direction="column" spacing={2}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 4 }}>
        <TextField
            label="Image name"
            sx={{ width: 480 }}
          variant="outlined"
            onChange={handleImagenameChange}
            value={imagename ?? ''}
        />

          <Button variant="contained" onClick={fetchAndDisplayResponse} disabled={buttonText !== undefined || imagename === undefined}>
            {buttonText === undefined ? "Get image size" : buttonText}
          </Button>
        </Stack>
        {RenderResultTree()}
      </Stack>
    </>
  );
}
